HV stats based on battle logs. Sample images can be found [here](https://github.com/anon962/HvLogV3//tree/master/readme_files/samples).

## Installing

Copy the latest [hvlog.user.js file](https://github.com/anon962/HvLogV3/releases/download/latest/hvlog.user.js) from the releases section to your userscript extension.

## Development

```bash
# Download and install
git clone https://github.com/anon962/HvLogV3/
cd HvLogV3
npm install

# Dev build
npm run dev

# Prod build
npm run build
```

## Boring stuff

-   Entire battle log (after parsing via regex) is saved to IndexedDb. Any lines that failed to parse are also saved.
    -   Logs eat up ~90 bytes per turn after compression and ~1800 bytes before compression.
-   UI uses react and [shadcn components](https://ui.shadcn.com/) / tailwind.
-   Userscript bundle is generated with [vite](https://vite.dev/guide/) and [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey/)
-   Database can be exported in a jsonl format using the menu commands. Each line in the resulting plaintext file represents a logged battle in regular json.
    -   Settings and any in-progress battle data is not exported. Settings can be found in localstorage and if you really need in-progress data, open the IndexedDb table in devtools.
