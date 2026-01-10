---
id: task-17.5
title: 'Phase 2.1: macOS App Usage Tracking (Native Module)'
status: To Do
assignee: []
created_date: '2026-01-10 06:42'
labels:
  - phase-2
  - native
  - macos
  - tracking
dependencies:
  - task-17.2
parent_task_id: task-17
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build native Swift helper to track foreground app and user activity on macOS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                     │
│                                                             │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │  Swift Helper   │ IPC  │  AppTracker Module          │  │
│  │  (native binary)│◄────►│  (Node.js)                  │  │
│  └─────────────────┘      └─────────────────────────────┘  │
│          │                              │                   │
│          ▼                              ▼                   │
│  ┌─────────────────┐      ┌─────────────────────────────┐  │
│  │ NSWorkspace     │      │  EventStore.append()        │  │
│  │ Accessibility   │      │  app.focused events         │  │
│  └─────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Swift Helper Implementation

```swift
// native/AppTracker/Sources/main.swift

import Cocoa
import Foundation

class AppTracker {
    private var lastApp: String = ""
    private var lastTitle: String = ""
    private var lastActivityTime: Date = Date()
    private var isIdle: Bool = false
    
    func start() {
        // Watch for app activation
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(appDidActivate),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )
        
        // Watch for screen sleep (idle)
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(screenDidSleep),
            name: NSWorkspace.screensDidSleepNotification,
            object: nil
        )
        
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(screenDidWake),
            name: NSWorkspace.screensDidWakeNotification,
            object: nil
        )
        
        // Poll for window title changes (every 5 seconds)
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            self.checkCurrentApp()
        }
        
        // Initial check
        checkCurrentApp()
        
        RunLoop.main.run()
    }
    
    @objc func appDidActivate(_ notification: Notification) {
        if let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication {
            emitAppFocused(app)
        }
    }
    
    @objc func screenDidSleep(_ notification: Notification) {
        isIdle = true
        emit(Event(
            type: "app.idle_start",
            data: ["app": lastApp]
        ))
    }
    
    @objc func screenDidWake(_ notification: Notification) {
        isIdle = false
        emit(Event(
            type: "app.idle_end",
            data: ["app": lastApp, "duration": Date().timeIntervalSince(lastActivityTime)]
        ))
        lastActivityTime = Date()
    }
    
    func checkCurrentApp() {
        guard let frontmost = NSWorkspace.shared.frontmostApplication else { return }
        
        let appName = frontmost.localizedName ?? "Unknown"
        let bundleId = frontmost.bundleIdentifier ?? ""
        
        // Get window title via Accessibility API
        let windowTitle = getWindowTitle(for: frontmost) ?? ""
        
        // Only emit if changed
        if appName != lastApp || windowTitle != lastTitle {
            emitAppFocused(frontmost)
            lastApp = appName
            lastTitle = windowTitle
        }
    }
    
    func emitAppFocused(_ app: NSRunningApplication) {
        emit(Event(
            type: "app.focused",
            data: [
                "app": app.localizedName ?? "Unknown",
                "bundleId": app.bundleIdentifier ?? "",
                "title": getWindowTitle(for: app) ?? "",
                "idle": isIdle
            ]
        ))
        lastActivityTime = Date()
    }
    
    func getWindowTitle(for app: NSRunningApplication) -> String? {
        let pid = app.processIdentifier
        let appElement = AXUIElementCreateApplication(pid)
        
        var value: AnyObject?
        let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &value)
        
        guard result == .success, let window = value else { return nil }
        
        var title: AnyObject?
        AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &title)
        
        return title as? String
    }
    
    func emit(_ event: Event) {
        let json = try! JSONEncoder().encode(event)
        print(String(data: json, encoding: .utf8)!)
        fflush(stdout)
    }
}

struct Event: Codable {
    let ts: String = ISO8601DateFormatter().string(from: Date())
    let type: String
    let data: [String: Any]
    
    // Custom encoding for Any values
}

// Start tracking
let tracker = AppTracker()
tracker.start()
```

## Node.js Integration

```typescript
// src/tracking/app-tracker.ts
import { spawn, ChildProcess } from 'child_process';
import { EventStore } from '../events/store';

export class AppTracker {
  private helperProcess: ChildProcess | null = null;
  private eventStore: EventStore;
  
  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }
  
  async start(): Promise<void> {
    const helperPath = path.join(__dirname, '../../native/AppTracker/build/AppTracker');
    
    // Check if helper exists
    if (!await fs.pathExists(helperPath)) {
      console.warn('AppTracker helper not found. App tracking disabled.');
      return;
    }
    
    this.helperProcess = spawn(helperPath);
    
    const rl = readline.createInterface({
      input: this.helperProcess.stdout
    });
    
    rl.on('line', (line) => {
      try {
        const event = JSON.parse(line);
        this.eventStore.append(event);
      } catch (err) {
        console.error('Failed to parse app event:', err);
      }
    });
    
    this.helperProcess.stderr.on('data', (data) => {
      console.error('AppTracker error:', data.toString());
    });
  }
  
  stop(): void {
    if (this.helperProcess) {
      this.helperProcess.kill();
      this.helperProcess = null;
    }
  }
}
```

## Permissions

macOS requires:
1. **Accessibility permissions** - For window titles
2. **Automation permissions** - For some apps

Handle gracefully if not granted:
```typescript
async function checkPermissions(): Promise<PermissionStatus> {
  // Check via helper or Electron API
  // Return { accessibility: boolean, automation: boolean }
}
```

## Build System

```makefile
# native/AppTracker/Makefile

build:
	swift build -c release
	cp .build/release/AppTracker build/

clean:
	rm -rf .build build
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Swift helper tracks foreground app changes
- [ ] #2 Window titles captured via Accessibility API
- [ ] #3 Idle detection on screen sleep/wake
- [ ] #4 Events emitted as JSON to stdout
- [ ] #5 Node.js module spawns and reads from helper
- [ ] #6 Events stored in EventStore
- [ ] #7 Graceful handling of missing permissions
- [ ] #8 Helper bundled with Electron app
- [ ] #9 Works without helper (degraded mode)
<!-- AC:END -->
