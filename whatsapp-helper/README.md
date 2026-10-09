# Optional WhatsApp Web helper — experimental

This is a local browser helper, **not an official WhatsApp integration or full chat export**. It imports supported text messages currently rendered in the one open WhatsApp Web tab. It may open an exact-name match in the loaded sidebar. If the name is absent or ambiguous, open the desired chat manually and retry. It does not automatically scroll, read unloaded history, collect other chats, send messages, read cookies/login tokens or upload messages to a server.

## Install in Brave for a local test

1. Review the four small source files. The helper needs permission to read WhatsApp Web and runs a bridge only on CatchUp's local preview / GitHub Pages path.
2. Open `brave://extensions`, enable Developer mode, select Load unpacked and select this `whatsapp-helper` folder. Installing grants persistent read access to WhatsApp Web; disable/remove the helper after testing if you do not need it.
3. Reload CatchUp and WhatsApp Web. Sign in to WhatsApp Web yourself using your own account.
4. In CatchUp, expand **Import from WhatsApp Web**, enter an exact chat name and click **Import loaded messages**. This changes the selected chat and may mark it read in WhatsApp.
5. Verify the displayed chat name and import count; CatchUp labels it partial. Select Catch me up. Messages stay in the browser unless you explicitly export/save them.

The website cannot install this helper or sign in to WhatsApp on your behalf. The current adapter relies on WhatsApp's rendered page structure and may break when that interface changes. The experimental adapter has **not yet been tested against a logged-in real WhatsApp chat**. Official phone export + Upload .txt remains the supported fallback.
