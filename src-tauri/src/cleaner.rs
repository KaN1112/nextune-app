use crate::models::{AppError, AppResult};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime},
};

const MIN_AGE: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_FILES: usize = 5000;
#[derive(Clone)]
pub struct Candidate {
    path: PathBuf,
    root: PathBuf,
    size: u64,
    modified: SystemTime,
    category: String,
}
pub struct Scan {
    pub response: ScanResponse,
    pub files: Vec<Candidate>,
    pub created: Instant,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub count: usize,
    pub bytes: u64,
    pub status: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResponse {
    pub token: String,
    pub categories: Vec<Category>,
    pub capped: bool,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub deleted: usize,
    pub skipped: usize,
    pub failed: usize,
    pub bytes: u64,
}

fn roots() -> Vec<(&'static str, &'static str, Option<PathBuf>)> {
    let local = crate::known_folders::local_app_data();
    let windows = crate::known_folders::windows();
    vec![
        (
            "user",
            "ユーザーの一時ファイル",
            local.as_ref().map(|p| p.join("Temp")),
        ),
        (
            "windows",
            "Windowsの一時ファイル",
            windows.map(|p| p.join("Temp")),
        ),
        (
            "shader",
            "DirectXシェーダーキャッシュ",
            local.as_ref().map(|p| p.join("D3DSCache")),
        ),
        (
            "crash",
            "クラッシュログ",
            local.map(|p| p.join("CrashDumps")),
        ),
    ]
}
fn has_reparse(path: &Path) -> bool {
    path.ancestors().any(|p| match fs::symlink_metadata(p) {
        Ok(m) => {
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                m.file_attributes() & 0x400 != 0
            }
            #[cfg(not(windows))]
            {
                m.file_type().is_symlink()
            }
        }
        Err(_) => true,
    })
}
pub fn scan() -> AppResult<Scan> {
    let mut files = Vec::new();
    let mut categories = Vec::new();
    let mut capped = false;
    for (id, name, root) in roots() {
        let mut category = Category {
            id: id.into(),
            name: name.into(),
            count: 0,
            bytes: 0,
            status: "スキャン済み・直下の24時間以上前のファイル".into(),
        };
        if let Some(root) = root {
            if !root.exists() {
                category.status = "取得できません".into();
            } else if has_reparse(&root) {
                category.status = "除外・リンクまたはアクセスできない場所".into();
            } else if let Ok(entries) = fs::read_dir(&root) {
                let canonical = fs::canonicalize(&root)?;
                for entry in entries {
                    if files.len() >= MAX_FILES {
                        capped = true;
                        break;
                    }
                    let Ok(entry) = entry else { continue };
                    let path = entry.path();
                    let Ok(meta) = fs::symlink_metadata(&path) else {
                        continue;
                    };
                    if !meta.is_file() || has_reparse(&path) {
                        continue;
                    }
                    let Ok(modified) = meta.modified() else {
                        continue;
                    };
                    if SystemTime::now()
                        .duration_since(modified)
                        .unwrap_or_default()
                        < MIN_AGE
                    {
                        continue;
                    }
                    category.count += 1;
                    category.bytes += meta.len();
                    files.push(Candidate {
                        path,
                        root: canonical.clone(),
                        size: meta.len(),
                        modified,
                        category: id.into(),
                    });
                }
            } else {
                category.status = "アクセス拒否・管理者権限が必要な場合があります".into();
            }
        } else {
            category.status = "未対応・Windowsが管理しています".into();
        }
        categories.push(category);
    }
    Ok(Scan {
        response: ScanResponse {
            token: uuid::Uuid::new_v4().to_string(),
            categories,
            capped,
        },
        files,
        created: Instant::now(),
    })
}

#[cfg(windows)]
fn delete_candidate(candidate: &Candidate) -> AppResult<bool> {
    use std::ffi::c_void;
    use std::os::windows::{fs::OpenOptionsExt, io::AsRawHandle};
    #[link(name = "kernel32")]
    extern "system" {
        fn GetFinalPathNameByHandleW(
            handle: *mut c_void,
            buffer: *mut u16,
            size: u32,
            flags: u32,
        ) -> u32;
        fn SetFileInformationByHandle(
            handle: *mut c_void,
            class: i32,
            info: *const c_void,
            size: u32,
        ) -> i32;
    }
    if has_reparse(&candidate.path) {
        return Ok(false);
    }
    // Do not share DELETE: rename/replacement cannot race validation while this handle lives.
    // OPEN_REPARSE_POINT prevents following a last-component link swapped in after the scan.
    let file = fs::OpenOptions::new()
        .access_mode(0x10000 | 0x80)
        .share_mode(0)
        .custom_flags(0x00200000)
        .open(&candidate.path)?;
    let meta = file.metadata()?;
    use std::os::windows::fs::MetadataExt;
    if !meta.is_file()
        || meta.file_attributes() & 0x400 != 0
        || meta.len() != candidate.size
        || meta.modified()? != candidate.modified
    {
        return Ok(false);
    }
    let mut buffer = vec![0u16; 32768];
    let len = unsafe {
        GetFinalPathNameByHandleW(
            file.as_raw_handle(),
            buffer.as_mut_ptr(),
            buffer.len() as u32,
            0,
        )
    };
    if len == 0 || len as usize >= buffer.len() {
        return Ok(false);
    }
    let actual = PathBuf::from(String::from_utf16_lossy(&buffer[..len as usize]));
    if actual.parent() != Some(candidate.root.as_path()) {
        return Ok(false);
    }
    #[repr(C)]
    struct Disposition {
        delete_file: u8,
    }
    let disposition = Disposition { delete_file: 1 };
    if unsafe {
        SetFileInformationByHandle(
            file.as_raw_handle(),
            4,
            &disposition as *const _ as *const c_void,
            std::mem::size_of::<Disposition>() as u32,
        )
    } == 0
    {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(true)
}
#[cfg(not(windows))]
fn delete_candidate(_: &Candidate) -> AppResult<bool> {
    Err(AppError::new("unsupported", "Windows環境が必要です。"))
}
pub fn run(scan: Scan, selected: &[String]) -> AppResult<CleanupResult> {
    if scan.created.elapsed() > Duration::from_secs(600) {
        return Err(AppError::new(
            "expired",
            "スキャン結果が失効しました。削除前に再スキャンしてください。",
        ));
    }
    if selected.is_empty()
        || selected
            .iter()
            .any(|id| !scan.response.categories.iter().any(|c| &c.id == id))
    {
        return Err(AppError::new(
            "invalid_selection",
            "スキャン済みのカテゴリを選択してください。",
        ));
    }
    let mut result = CleanupResult::default();
    for file in scan.files.iter().filter(|f| selected.contains(&f.category)) {
        match delete_candidate(file) {
            Ok(true) => {
                result.deleted += 1;
                result.bytes += file.size;
            }
            Ok(false) => result.skipped += 1,
            Err(e) if e.code == "access_denied" || e.code == "file_in_use" => result.skipped += 1,
            Err(_) => result.failed += 1,
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (PathBuf, Candidate) {
        let root = std::env::current_dir()
            .unwrap()
            .join("target")
            .join("cleaner-fixtures")
            .join(uuid::Uuid::new_v4().to_string());
        fs::create_dir_all(&root).unwrap();
        let path = root.join("test.tmp");
        fs::write(&path, b"fixture").unwrap();
        let m = fs::metadata(&path).unwrap();
        let candidate = Candidate {
            path,
            root: fs::canonicalize(&root).unwrap(),
            size: m.len(),
            modified: m.modified().unwrap(),
            category: "user".into(),
        };
        (root, candidate)
    }
    #[test]
    fn deletes_only_verified_fixture() {
        let (root, file) = fixture();
        assert!(delete_candidate(&file).unwrap());
        assert!(!file.path.exists());
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn changed_file_is_skipped() {
        let (root, file) = fixture();
        fs::write(&file.path, b"changed data must survive").unwrap();
        assert!(!delete_candidate(&file).unwrap());
        assert!(file.path.exists());
        fs::remove_file(file.path).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn wrong_root_is_skipped() {
        let (root, mut file) = fixture();
        file.root = root.join("other");
        assert!(!delete_candidate(&file).unwrap());
        fs::remove_file(file.path).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn in_use_file_is_not_deleted() {
        let (root, file) = fixture();
        let handle = fs::File::open(&file.path).unwrap();
        assert!(delete_candidate(&file).is_err());
        assert!(file.path.exists());
        drop(handle);
        fs::remove_file(file.path).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn quick_cleanup_preserves_other_categories() {
        let (user_root, user) = fixture();
        let (other_root, mut other) = fixture();
        other.category = "shader".into();
        let kept = other.path.clone();
        let scan = Scan {
            response: ScanResponse { token: "quick".into(), capped: false,
                categories: vec![Category {id:"user".into(),name:"temp".into(),count:1,bytes:user.size,status:String::new()}] },
            files: vec![user,other], created:Instant::now(),
        };
        let result = quick_run(scan).unwrap();
        assert_eq!(result.deleted,1);
        assert!(kept.exists());
        fs::remove_file(kept).unwrap();
        fs::remove_dir(user_root).unwrap();
        fs::remove_dir(other_root).unwrap();
    }
    #[test]
    fn expired_scan_cannot_delete() {
        let (root, file) = fixture();
        let path = file.path.clone();
        let scan = Scan {
            response: ScanResponse {
                token: "test".into(),
                categories: vec![],
                capped: false,
            },
            files: vec![file],
            created: Instant::now() - Duration::from_secs(601),
        };
        assert!(run(scan, &["user".into()]).is_err());
        assert!(path.exists());
        fs::remove_file(path).unwrap();
        fs::remove_dir(root).unwrap();
    }
}

/// One click: only old user Temp files. Existing per-handle checks apply unchanged.
pub fn quick_cleanup() -> AppResult<CleanupResult> {
    quick_run(scan()?)
}

fn quick_run(scan: Scan) -> AppResult<CleanupResult> {
    run(scan, &["user".into()])
}
