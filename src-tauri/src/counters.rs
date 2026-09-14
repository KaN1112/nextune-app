// Read-only Windows performance counters. No service, driver, or counter repair changes.
#[cfg(windows)]
mod windows {
    #[repr(C)]
    struct CounterValue {
        status: u32,
        value: f64,
    }
    #[link(name = "pdh")]
    extern "system" {
        fn PdhOpenQueryW(source: *const u16, user: usize, query: *mut isize) -> u32;
        fn PdhAddEnglishCounterW(
            query: isize,
            path: *const u16,
            user: usize,
            counter: *mut isize,
        ) -> u32;
        fn PdhCollectQueryData(query: isize) -> u32;
        fn PdhGetFormattedCounterValue(
            counter: isize,
            format: u32,
            kind: *mut u32,
            value: *mut CounterValue,
        ) -> u32;
        fn PdhCloseQuery(query: isize) -> u32;
    }
    pub struct DiskCounter {
        query: isize,
        counter: isize,
    }
    impl DiskCounter {
        pub fn new() -> Option<Self> {
            let mut query = 0;
            let mut counter = 0;
            let path: Vec<u16> = "\\PhysicalDisk(_Total)\\Disk Bytes/sec"
                .encode_utf16()
                .chain(Some(0))
                .collect();
            unsafe {
                if PdhOpenQueryW(std::ptr::null(), 0, &mut query) != 0 {
                    return None;
                }
                if PdhAddEnglishCounterW(query, path.as_ptr(), 0, &mut counter) != 0 {
                    PdhCloseQuery(query);
                    return None;
                }
                PdhCollectQueryData(query);
            }
            Some(Self { query, counter })
        }
        pub fn sample(&mut self) -> Option<u64> {
            let mut value = CounterValue {
                status: 0,
                value: 0.,
            };
            unsafe {
                if PdhCollectQueryData(self.query) != 0
                    || PdhGetFormattedCounterValue(
                        self.counter,
                        0x200,
                        std::ptr::null_mut(),
                        &mut value,
                    ) != 0
                {
                    return None;
                }
            }
            if value.status > 1 || !value.value.is_finite() || value.value < 0. {
                None
            } else {
                Some(value.value as u64)
            }
        }
    }
    impl Drop for DiskCounter {
        fn drop(&mut self) {
            unsafe {
                PdhCloseQuery(self.query);
            }
        }
    }
}
#[cfg(windows)]
pub use windows::DiskCounter;
#[cfg(not(windows))]
pub struct DiskCounter;
#[cfg(not(windows))]
impl DiskCounter {
    pub fn new() -> Option<Self> {
        None
    }
    pub fn sample(&mut self) -> Option<u64> {
        None
    }
}
