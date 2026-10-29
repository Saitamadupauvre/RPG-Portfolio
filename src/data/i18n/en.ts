import type { MessageText } from '../locale';

/**
 * Every interface string, in English. The source of truth for the keys: `fr.ts`
 * must define each one (`Record<MessageKey, …>`), so a key added here and not
 * translated fails the build. Authored content (projects, pages, tips) is not
 * here: it carries its own languages (`LocalizedText`).
 *
 * `{name}` is filled from the call's parameters. A `{ one, other }` entry is
 * picked by `count`, with the plural rules of the language.
 */
export const en = {
    // ---------- menu ----------
    'menu.kicker': 'A playable portfolio',
    'menu.tagline': 'A small open world to roam. Every glowing statue holds one of my projects.',
    'menu.nav': 'Choose how to browse',
    'menu.play': 'Play the game',
    'menu.play.hint': 'Explore, fight, discover the projects',
    'menu.play.touchHint': 'Needs a keyboard and mouse: open it on a computer',
    'menu.fast': 'Fast portfolio',
    'menu.fast.hint': 'Every project in one list, no game',
    'menu.callout': 'Recruiter in a hurry?',
    'menu.callout.cta': 'Start here',
    'menu.footer': 'Keyboard & mouse · best on desktop',
    'menu.language': 'Language',

    // ---------- loading ----------
    'loading.label': 'Loading',

    // ---------- book frame ----------
    'book.prev': 'Previous page',
    'book.next': 'Next page',
    'book.close': 'Close book',
    'book.cover': 'Portfolio',
    'book.blank': 'This page is blank.',
    'book.empty': 'Nothing written here yet.',
    'book.locked': 'Locked',
    'book.section.projects': 'Projects',
    'book.section.timeline': 'Timeline',
    'book.section.about': 'About',
    'book.section.tutorial': 'Tutorial',
    'book.section.level': 'Level',
    'book.section.settings': 'Settings',

    // ---------- projects & timeline ----------
    'project.kicker': 'Project',
    'project.kicker.rarity': 'Project · {rarity}',
    'project.locked': 'Not yet found. Explore the world to reveal this project.',
    'project.progress': '{found}/{total} projects found',
    'project.inProgress': 'In progress',
    'project.demo': 'Live demo',
    'project.repo': 'Source code',
    'project.channel': 'Watch on YouTube',
    'rarity.common': 'Common',
    'rarity.rare': 'Rare',
    'rarity.epic': 'Epic',
    'rarity.legendary': 'Legendary',
    'timeline.kicker': 'Timeline',
    'timeline.locked': 'Find the projects of this chapter to read it.',

    // ---------- level ----------
    'level.title': 'Level {level}',
    'level.coins': { one: '{count} coin', other: '{count} coins' },
    'level.kicker': 'Level',
    'level.heading': 'Stats',
    'level.rank': 'Lv {level}/{max}',
    'level.next': '{value} → {next}',
    'level.maxed': '{value} · maxed',
    'level.buy': 'Buy · {cost}',
    'level.max': 'Max',
    'level.hint': 'Rest at a bonfire to spend your coins.',
    'stat.health.name': 'Vitality',
    'stat.health.value': '{value} HP',
    'stat.damage.name': 'Strength',
    'stat.damage.value': '{value} DMG',
    'stat.speed.name': 'Agility',
    'stat.speed.value': '{value} SPD',

    // ---------- settings ----------
    'action.up': 'Move up',
    'action.left': 'Move left',
    'action.down': 'Move down',
    'action.right': 'Move right',
    'action.dash': 'Dash',
    'action.interact': 'Interact',
    'action.levelUp': 'Level up',
    'action.book': 'Open book',
    'settings.controls': 'Controls',
    'settings.movement': 'Movement',
    'settings.attack': 'Attack',
    'settings.settings': 'Settings',
    'settings.keys.hint': 'Click a key to change it. The arrow keys move too.',
    'settings.keys.listening': 'Press the new key. Esc cancels.',
    'settings.keys.reserved': 'Reserved: the arrows, Esc, Tab and the F keys.',
    'settings.keys.aria': '{action}: {key}. Click to change.',
    'settings.keys.reset': 'Reset keys',
    'settings.kicker': 'Settings',
    'settings.options': 'Options',
    'settings.graphics': 'Graphics',
    'settings.quality': 'Quality',
    'settings.quality.low': 'Low',
    'settings.quality.medium': 'Medium',
    'settings.quality.high': 'High',
    'settings.quality.low.hint': 'No shadows, no grass: for older computers.',
    'settings.quality.medium.hint': 'Shadows and grass at standard resolution.',
    'settings.quality.high.hint': 'Everything, sharper on high-density screens.',
    'settings.screenShake': 'Screen shake',
    'settings.on': 'On',
    'settings.off': 'Off',
    'settings.sound': 'Sound',
    'settings.music': 'Music',
    'settings.sfx': 'Effects',
    'settings.volume.aria': '{channel} volume',
    'settings.game': 'Game',
    'settings.language': 'Language',
    'settings.quit': 'Quit to menu',
    'settings.resetProgress': 'Reset progress',
    'settings.resetProgress.confirm': 'Click again to erase',
    'settings.resetProgress.hint': 'Reset erases coins, stats, discoveries and your bonfire. Settings stay.',

    // ---------- in game ----------
    'prompt.rest': 'Rest at bonfire',
    'prompt.levelUp': 'Level up',
    'prompt.openChest': 'Open chest',
    'prompt.examine': 'Examine {title}',
    'prompt.examineStatue': 'Examine statue',
    'loot.empty': 'Empty chest',
    'loot.coins': { one: '+{count} coin', other: '+{count} coins' },
    'loot.project': 'Discovered {title}',
    'loot.stat': '{stat} +1',
    'key.mouseLeft': 'Left mouse button',
} satisfies Record<string, MessageText>;

export type MessageKey = keyof typeof en;
