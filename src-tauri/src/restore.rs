use crate::{models::*, optimizer, settings};
use std::{fs, path::Path};

pub fn history(root: &Path) -> AppResult<Vec<RestoreSession>> {
    let folder = root.join("restore");
    fs::create_dir_all(&folder)?;
    let mut sessions = Vec::new();
    for entry in fs::read_dir(folder)? {
        let path = entry?.path();
        if path.extension().is_some_and(|e| e == "json") {
            sessions.push(serde_json::from_slice::<RestoreSession>(&fs::read(path)?)?);
        }
    }
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}
pub fn save(root: &Path, session: &RestoreSession) -> AppResult<()> {
    let id = uuid::Uuid::parse_str(&session.id)
        .map_err(|_| AppError::new("invalid_id", "履歴の識別子が正しくありません。"))?;
    settings::atomic_json(&root.join("restore").join(format!("{id}.json")), session)
}
pub fn prepare(root: &Path, before: String) -> AppResult<RestoreSession> {
    let session = RestoreSession {
        id: uuid::Uuid::new_v4().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        version: "1.0.0".into(),
        changes: vec![Change {
            kind: "powerPlan".into(),
            before,
            after: optimizer::HIGH.into(),
        }],
        status: "pending".into(),
    };
    // Persist intent BEFORE changing Windows, so an interrupted operation remains recoverable.
    save(root, &session)?;
    Ok(session)
}
pub fn restore(root: &Path, id: &str) -> AppResult<RestoreSession> {
    restore_with(root, id, optimizer::active_plan, optimizer::set_plan)
}
fn restore_with(
    root: &Path,
    id: &str,
    read: impl Fn() -> AppResult<String>,
    set: impl Fn(&str) -> AppResult<()>,
) -> AppResult<RestoreSession> {
    let id = uuid::Uuid::parse_str(id)
        .map_err(|_| AppError::new("invalid_id", "履歴の識別子が正しくありません。"))?
        .to_string();
    let mut session = history(root)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::new("not_found", "復元する履歴が見つかりません。"))?;
    if session.status == "restored" {
        return Err(AppError::new(
            "already_restored",
            "この履歴はすでに復元済みです。",
        ));
    }
    if session.changes.len() != 1
        || session.changes[0].kind != "powerPlan"
        || session.changes[0].after != optimizer::HIGH
    {
        return Err(AppError::new(
            "unsupported",
            "対応していない復元データです。",
        ));
    }
    let change = &session.changes[0];
    let current = read()?;
    if current != change.after && current != change.before {
        return Err(AppError::new("setting_changed", "この履歴とは別に電源プランが変更されています。現在の設定を保持するため、復元を停止しました。"));
    }
    if current != change.before {
        set(&change.before)?;
    }
    session.status = "restored".into();
    save(root, &session)?;
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    fn folder() -> std::path::PathBuf {
        std::env::current_dir()
            .unwrap()
            .join("target")
            .join("restore-fixtures")
            .join(uuid::Uuid::new_v4().to_string())
    }
    fn clean(root: &Path, session: &RestoreSession) {
        fs::remove_file(root.join("restore").join(format!("{}.json", session.id))).unwrap();
        fs::remove_dir(root.join("restore")).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn pending_intent_is_recoverable_and_restore_is_persisted() {
        let root = folder();
        let session = prepare(&root, optimizer::BALANCED.into()).unwrap();
        assert_eq!(history(&root).unwrap()[0].status, "pending");
        let current = RefCell::new(optimizer::HIGH.to_string());
        let restored = restore_with(
            &root,
            &session.id,
            || Ok(current.borrow().clone()),
            |id| {
                *current.borrow_mut() = id.into();
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(restored.status, "restored");
        assert_eq!(*current.borrow(), optimizer::BALANCED);
        assert_eq!(history(&root).unwrap()[0].status, "restored");
        clean(&root, &session);
    }
    #[test]
    fn external_change_is_preserved() {
        let root = folder();
        let session = prepare(&root, optimizer::BALANCED.into()).unwrap();
        let result = restore_with(
            &root,
            &session.id,
            || Ok("other-plan".into()),
            |_| panic!("must not write"),
        );
        assert_eq!(result.unwrap_err().code, "setting_changed");
        clean(&root, &session);
    }
    #[test]
    fn path_traversal_is_rejected() {
        assert_eq!(
            restore_with(Path::new("."), "../settings", || panic!(), |_| panic!())
                .unwrap_err()
                .code,
            "invalid_id"
        );
    }
}
