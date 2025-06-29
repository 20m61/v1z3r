# Page snapshot

```yaml
- dialog "Unhandled Runtime Error":
  - navigation:
    - button "previous" [disabled]:
      - img "previous"
    - button "next":
      - img "next"
    - text: 1 of 2 errors Next.js (14.2.30) is outdated
    - link "(learn more)":
      - /url: https://nextjs.org/docs/messages/version-staleness
  - button "Close"
  - heading "Unhandled Runtime Error" [level=1]
  - paragraph: "TypeError: Failed to construct 'PermissionStatus': Illegal constructor"
  - heading "Source" [level=2]
  - link "src/components/ControlPanel.tsx (48:22) @ eval":
    - text: src/components/ControlPanel.tsx (48:22) @ eval
    - img
  - text: "46 | // マイクやカメラの変更を追跡 47 | useEffect(() => { > 48 | const observer = new PermissionStatus(); | ^ 49 | 50 | // マイクやカメラの権限変更を監視（ブラウザがサポートしている場合） 51 | if (navigator.permissions) {"
  - heading "Call Stack" [level=2]
  - button "Show collapsed frames"
```