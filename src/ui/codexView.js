import { UI as UI_CONFIG } from '../config.js';

function entry(name, meta, seen, lockedName, lockedDesc, className = '') {
  const card = document.createElement('div');
  card.className = `codex-entry ${seen ? '' : 'locked'} ${className}`.trim();
  const title = document.createElement('strong');
  title.className = 'codex-name';
  title.textContent = seen ? name : lockedName;
  const tag = document.createElement('span');
  tag.className = 'codex-meta';
  tag.textContent = seen ? meta : lockedDesc;
  card.append(title, tag);
  return card;
}

export function renderCodex(container, snapshot) {
  const cfg = UI_CONFIG.codex;
  container.replaceChildren();
  const enemySection = document.createElement('section');
  const enemyTitle = document.createElement('h3');
  enemyTitle.className = 'codex-section-title';
  enemyTitle.textContent = cfg.enemyTitle;
  const enemyGrid = document.createElement('div');
  enemyGrid.className = 'codex-grid';
  for (const enemy of snapshot.enemies) {
    enemyGrid.appendChild(entry(enemy.name, enemy.seen ? 'ENCOUNTERED' : cfg.lockedDesc, enemy.seen, cfg.lockedName, cfg.lockedDesc));
  }
  enemySection.append(enemyTitle, enemyGrid);

  const upgradeSection = document.createElement('section');
  const upgradeTitle = document.createElement('h3');
  upgradeTitle.className = 'codex-section-title';
  upgradeTitle.textContent = cfg.upgradeTitle;
  const upgradeGrid = document.createElement('div');
  upgradeGrid.className = 'codex-grid upgrades';
  for (const upgrade of snapshot.upgrades) {
    const className = upgrade.kind === 'evolution' ? 'evolution' : '';
    upgradeGrid.appendChild(entry(
      upgrade.name,
      upgrade.seen ? `${upgrade.tag} · ${upgrade.description}` : cfg.lockedDesc,
      upgrade.seen,
      cfg.lockedName,
      cfg.lockedDesc,
      className,
    ));
  }
  upgradeSection.append(upgradeTitle, upgradeGrid);
  container.append(enemySection, upgradeSection);
}
