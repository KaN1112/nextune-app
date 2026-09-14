use std::path::PathBuf;

#[cfg(windows)]
pub fn local_app_data() -> Option<PathBuf> {
    #[repr(C)]
    struct Guid {
        a: u32,
        b: u16,
        c: u16,
        d: [u8; 8],
    }
    #[link(name = "shell32")]
    extern "system" {
        fn SHGetKnownFolderPath(
            id: *const Guid,
            flags: u32,
            token: isize,
            path: *mut *mut u16,
        ) -> i32;
    }
    #[link(name = "ole32")]
    extern "system" {
        fn CoTaskMemFree(memory: *mut std::ffi::c_void);
    }
    // FOLDERID_LocalAppData: obtain the OS-owned location, never trust an inherited TEMP path.
    let id = Guid {
        a: 0xf1b32785,
        b: 0x6fba,
        c: 0x4fcf,
        d: [0x9d, 0x55, 0x7b, 0x8e, 0x7f, 0x15, 0x70, 0x91],
    };
    let mut pointer = std::ptr::null_mut();
    unsafe {
        if SHGetKnownFolderPath(&id, 0, 0, &mut pointer) < 0 || pointer.is_null() {
            return None;
        }
        let mut len = 0;
        while *pointer.add(len) != 0 {
            len += 1;
        }
        let path = PathBuf::from(String::from_utf16_lossy(std::slice::from_raw_parts(
            pointer, len,
        )));
        CoTaskMemFree(pointer as *mut std::ffi::c_void);
        Some(path)
    }
}
#[cfg(windows)]
pub fn windows() -> Option<PathBuf> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetWindowsDirectoryW(buffer: *mut u16, size: u32) -> u32;
    }
    let mut buffer = vec![0u16; 32768];
    let len = unsafe { GetWindowsDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32) };
    if len == 0 || len as usize >= buffer.len() {
        None
    } else {
        Some(PathBuf::from(String::from_utf16_lossy(
            &buffer[..len as usize],
        )))
    }
}
#[cfg(not(windows))]
pub fn local_app_data() -> Option<PathBuf> {
    None
}
#[cfg(not(windows))]
pub fn windows() -> Option<PathBuf> {
    None
}
