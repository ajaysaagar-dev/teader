const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '178.238.226.206',
  user: process.env.POSTGRES_USER || 'ajaysaagar',
  password: process.env.POSTGRES_PASSWORD || 'aass209c',
  database: process.env.POSTGRES_DATABASE || 'ajaysaagar',
  port: 5432,
  connectionTimeoutMillis: 5000,
});

const docsDir = path.join(process.cwd(), 'data', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// 1. Read UVC content from UVC.md (485KB)
const uvcContent = fs.readFileSync(path.join(process.cwd(), 'UVC.md'), 'utf8');

// 2. Architecture content
const archContent = `# Unknown 13 — Architecture & Technical Specifications

Technical specification, scene progression, and architecture documentation for **Unknown-13** (Repository: \`Backlight Files - Unknown 13@unity_8733125baa94a65b1bd2@unity\`).

## 1. Overview & System Goals
Unknown-13 is a psychological horror/mystery game experience built in Unity URP with immersive interactive storytelling, camera transitions, atmospheric lighting, cutscene triggers, and role-based interaction.

---

## 2. Architecture & Components
- **Scene Progression Pipeline**: \`01_Office\` -> \`02_Driving\` -> \`03_EnterRoom\` -> \`04_Bathing\` -> \`05_DinnerSleep\` -> \`06_WatchingTV\` -> \`Roof_Top\`
- **Core Player & Interaction**: \`SC_PlayerMovementController\`, \`SC_PlayerEnteract\`, \`SC_Interactable_Base\`, \`SC_LightSwitch\`, \`SC_OpenDoor\`
- **Cutscenes & Sequences**: \`ElevatorSequenceController\`, \`SC_OfficeSceneIntroController\`, \`SC_JacuzziBathingSequence\`, \`SC_SofaInteractionSequence\`, \`SC_WatchingTVCameraTransition\`, \`SC_CookingController\`
- **Atmosphere & Environment**: Rain particle effects, thunder lighting, custom skyboxes (\`DarkSkybox_01\`), emissive materials, TV render texture (\`TV.renderTexture\`), audio cross-fades & sound triggers
- **Mobile / Phone Systems**: Phone flashlight controller (\`phoneflash.cs\`), Phone camera recording UI (\`sc_camerui.cs\`) with Nokia-style interface and sound effects

---

## 3. Implementation Steps & Development Milestones
- [x] Initial Unity UVC repository setup and lead dev branch initialization
- [x] Office Scene: Audio integration, atmospheric ambient sounds, light switch trigger & flashlight coupling
- [x] Driving Scene: Radio player, vehicle physics controller, driving camera and road transition
- [x] Enter Room & Bathroom: Clean architectural layout, Jacuzzi sequence, and custom curtain interaction
- [x] Watching TV Scene: Multi-angle sofa cameras, TV render textures, video playback integration
- [x] Roof Top Mission: Storm ecosystem, lightning spot illumination, car animations, and Nokia-style camera recording UI
- [x] Full Scene-to-Scene Transitions: Automated fade-in/fade-out controller and state synchronization

\`\`\`ts
// System Configuration Specification
export const config = {
  project: 'Backlight Files - Unknown 13',
  version: '2.0.0',
  totalChangesets: 99,
  branches: ['/main', '/main/ajaysaagar', '/main/balaji', '/main/harshar'],
  env: 'production'
};
\`\`\`
`;

(async () => {
  try {
    await pool.query('ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "content" TEXT;');

    // 1. Update UVC doc
    const file1 = 'proj_11_usr_13_doc_1787845578398_6288_uvc_01.md';
    const path1 = path.join(docsDir, file1);
    fs.writeFileSync(path1, uvcContent, 'utf8');
    await pool.query('UPDATE "project_docs" SET "content" = $1, "filePath" = $2 WHERE "id" = $3', [uvcContent, path1, 'doc_1787845578398_6288']);
    console.log('Saved UVC doc (bytes: ' + uvcContent.length + ') to disk and DB');

    // 2. Update Luzzy Basic Structure doc
    const file2 = 'proj_11_usr_13_doc_1787843809703_init_architecture_specs.md';
    const path2 = path.join(docsDir, file2);
    fs.writeFileSync(path2, archContent, 'utf8');
    await pool.query('UPDATE "project_docs" SET "content" = $1, "filePath" = $2 WHERE "id" = $3', [archContent, path2, 'doc_1787843809703_init']);
    console.log('Saved Luzzy Basic Structure doc (bytes: ' + archContent.length + ') to disk and DB');

    const check = await pool.query('SELECT "id", "title", LENGTH("content") as clen FROM "project_docs"');
    console.log('DB Records:', check.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
