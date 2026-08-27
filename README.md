HV stats based on battle logs. [Screenshots](https://github.com/anon962/HvLogV3//tree/master/readme_files/samples).

## Features

- Battle history <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/log_1.png">[1]</a>
- Income / expenses, with per-item breakdowns <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/drop_1.png">[1]</a> <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/drop_2.png">[2]</a>
- Equip drops. <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/eq_1.png">[1]</a>
- Combat stats (spells used, damage dealt, mob resist rate, healing per item / spell, etc). <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/combat_1.png">[1]</a> <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/combat_2.png">[2]</a> <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/combat_3.png">[3]</a> <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/combat_4.png">[4]</a>
- Full battle log <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/raw_1.png">[1]</a>
- Share-able links (by uploading to public server).

## Installing

Copy the latest [hvlog.user.js file](https://github.com/anon962/HvLogV3/releases/download/latest/hvlog.user.js) from the releases section to your userscript extension.  
After installing you can access the log history by opening your userscript extension and selecting one of the menu options <a href="https://raw.githubusercontent.com/anon962/HvLogV3/refs/heads/master/readme_files/samples/01.png">[2]</a>.

## Development

```bash
# Download and install
git clone https://github.com/anon962/HvLogV3/
cd HvLogV3
pnpm install

# Dev build
pnpm run udev

# Prod build
npm run ubuild
```

## Boring stuff

- Entire battle log (after parsing via regex) is saved to IndexedDb. Any lines that failed to parse are also saved.
    - Logs eat up ~45 bytes per turn after compression and ~450 bytes before compression.
- UI uses react and [shadcn components](https://ui.shadcn.com/) / tailwind.
