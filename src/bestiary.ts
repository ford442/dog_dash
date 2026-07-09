import { SaveManager } from './save_manager';

/**
 * The "Weird Life Log" — a light meta-collectible layer for the bespoke
 * bestiary creatures. Cataloging an entry the first time (via a non-lethal
 * encounter) is persistent across runs and grants a small permanent "memory"
 * bonus on future runs.
 */
export type BestiaryEntryId =
    | 'tarsier'
    | 'geode_titan'
    | 'kraken'
    | 'star_eater'
    | 'mine_robot'
    | 'moon_pup'
    | 'cosmic_otter'
    | 'astro_penguin'
    | 'nebula_puffer'
    | 'stellar_seal_pup'
    | 'astro_bunny'
    | 'moon_snail'
    | 'toy_wreck'
    | 'lunar_lemur';

export interface BestiaryEntry {
    id: BestiaryEntryId;
    name: string;
    icon: string;
    flavor: string;
    /** How the player catalogs this entry. */
    howTo: string;
    /** What the "memory" unlocks on future runs. */
    memoryDesc: string;
}

export const BESTIARY_ENTRIES: Record<BestiaryEntryId, BestiaryEntry> = {
    tarsier: {
        id: 'tarsier',
        name: 'Crystal Tarsier Guardian',
        icon: '\u{1F48E}', // gem stone
        flavor: 'A jeweled tarsier that perches on stellar cores, watching calm pilots with huge curious eyes.',
        howTo: 'Approach slowly and let it bless you without shooting it.',
        memoryDesc: 'Memory: Arc Surge sling assists last longer.'
    },
    geode_titan: {
        id: 'geode_titan',
        name: 'Living Geode Titan',
        icon: '\u{1F311}', // new moon (geode-ish sphere)
        flavor: 'A hollow geode the size of a moonlet, drifting with a glittering cavern at its heart.',
        howTo: 'Fly clean through its open hollow without clipping the rim.',
        memoryDesc: 'Memory: Flying through it grants extra cores.'
    },
    kraken: {
        id: 'kraken',
        name: 'Nebula Kraken',
        icon: '\u{1F419}', // octopus
        flavor: 'A biomechanical space squid that drifts through the asteroid belt, tentacles trailing nebula gas.',
        howTo: 'Get close to it and survive without destroying it.',
        memoryDesc: 'Memory: Defeating a Kraken later grants bonus cores.'
    },
    star_eater: {
        id: 'star_eater',
        name: 'The Star-Eater',
        icon: '\u{1F47E}', // alien monster
        flavor: 'A colossal pitcher-mawed leviathan said to swallow whole moons. You found it first.',
        howTo: 'Survive its first roar at the start of the boss fight.',
        memoryDesc: 'Memory: Defeating it grants a few extra cores.'
    },
    mine_robot: {
        id: 'mine_robot',
        name: 'Grumpy Mine Robot',
        icon: '\u{1F916}', // robot
        flavor: 'A rust-flecked drone that glares at passing rockets with big cartoon eyes.',
        howTo: 'Drift close enough to make its eyes go wide, without shooting it.',
        memoryDesc: 'Memory: A spare wrench auto-bounces one asteroid per level.'
    },
    moon_pup: {
        id: 'moon_pup',
        name: 'Moon Pup',
        icon: '\u{1F436}', // dog face
        flavor: 'A rare "good dog" in a tiny fishbowl helmet, rescued from drifting wreckage.',
        howTo: 'Rescue one from a trapped-friend cage.',
        memoryDesc: 'Memory: "Good Dog!" score multipliers last longer.'
    },
    cosmic_otter: {
        id: 'cosmic_otter',
        name: 'Cosmic Otter',
        icon: '\u{1F9A6}', // otter
        flavor: 'A playful space otter who juggles glowing orbs in zero gravity, balancing with its fluffy tail.',
        howTo: 'Fly close without shooting and let it share an orb with you.',
        memoryDesc: 'Memory: Otter orb gifts sometimes grant an extra core.'
    },
    astro_penguin: {
        id: 'astro_penguin',
        name: 'Astro Penguin',
        icon: '\u{1F427}', // penguin
        flavor: 'A tuxedoed explorer in a fishbowl helmet who belly-slides across the void, leaving glittering ice crystals.',
        howTo: 'Approach calmly and watch its excited belly slide without shooting.',
        memoryDesc: 'Memory: Penguin slide assists last longer.'
    },
    nebula_puffer: {
        id: 'nebula_puffer',
        name: 'Nebula Puffer',
        icon: '\u{1F41F}', // fish
        flavor: 'A round, spiky-but-cute drifter that puffs up like a living balloon when curious pilots glide by slowly.',
        howTo: 'Fly a gentle, slow pass nearby and watch it inflate without ramming it.',
        memoryDesc: 'Memory: Graze near-miss windows stay wider for longer.'
    },
    stellar_seal_pup: {
        id: 'stellar_seal_pup',
        name: 'Stellar Seal Pup',
        icon: '\u{1F9AD}', // seal
        flavor: 'A chubby seal pup in a tiny space bubble who claps its flippers to cheer you on through the void.',
        howTo: 'Fly close without shooting and let it clap for you.',
        memoryDesc: 'Memory: Seal claps brighten nearby stars longer and grant bonus score.'
    },
    astro_bunny: {
        id: 'astro_bunny',
        name: 'Astro Bunny',
        icon: '\u{1F430}', // rabbit
        flavor: 'A round little bunny in a clear bubble helmet whose lucky hops sprinkle wishing stars when you fly by.',
        howTo: 'Approach calmly and watch its excited double-hop without shooting.',
        memoryDesc: 'Memory: Sling combo chains stay alive longer between arcs.'
    },
    moon_snail: {
        id: 'moon_snail',
        name: 'Moon Snail',
        icon: '\u{1F41A}', // snail
        flavor: 'A house-sized spiral shell drifting through the late levels, trailing stardust and watching with gentle eye-stalks.',
        howTo: 'Glide close slowly without firing — let it bless you with a soft drift or star whisper.',
        memoryDesc: 'Memory: Snail blessings linger a little longer on future runs.'
    },
    toy_wreck: {
        id: 'toy_wreck',
        name: 'Drifted Toy Rocket',
        icon: '\u{1F680}', // rocket
        flavor: 'A tiny pastel rocket from someone else\'s voyage — bent fins, missing pieces, maybe a brave little flag.',
        howTo: 'Scan floating wreckage, or sling it in a spectacular arc.',
        memoryDesc: 'Memory: A story fragment, not a power — "Someone else\'s adventure..."'
    },
    lunar_lemur: {
        id: 'lunar_lemur',
        name: 'Lunar Lemur',
        icon: '\u{1F9A7}', // monkey
        flavor: 'A ring-tailed lemur with enormous moonlit eyes, perched on crystal spires and watching pilots drift by.',
        howTo: 'Approach calmly without shooting — let it greet you with a heart fruit.',
        memoryDesc: 'Memory: Night zones feel brighter — collectible glow lasts longer.'
    }
};

/** Renders the "Weird Life Log" bestiary modal. Caller is responsible for appending/removing it. */
export function createBestiaryUI(saveManager: SaveManager, onClose: () => void): HTMLDivElement {
    const cataloged = new Set(saveManager.getCatalogedCreatures());

    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 20, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-family: 'Segoe UI', sans-serif;
        color: white;
    `;

    const total = Object.keys(BESTIARY_ENTRIES).length;
    container.innerHTML = `
        <h1 style="font-size: 2.4em; margin-bottom: 4px; color: #aaffee; text-shadow: 0 0 20px rgba(170,255,238,0.5);">
            \u{1F4D6} Weird Life Log
        </h1>
        <p style="font-size: 1.1em; color: #88ccff; margin-bottom: 20px;">
            ${cataloged.size} / ${total} creatures cataloged
        </p>
        <div id="bestiary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; max-width: 720px; width: 90%; max-height: 55vh; overflow-y: auto; padding: 4px;"></div>
        <button id="close-bestiary" style="margin-top: 24px; padding: 12px 36px; font-size: 1.1em; background: #444; color: white; border: none; border-radius: 8px; cursor: pointer;">
            Close
        </button>
    `;

    const grid = container.querySelector('#bestiary-grid')!;

    for (const entry of Object.values(BESTIARY_ENTRIES)) {
        const known = cataloged.has(entry.id);
        const el = document.createElement('div');
        el.style.cssText = `
            background: rgba(255,255,255,0.08);
            padding: 14px;
            border-radius: 10px;
            border: 2px solid ${known ? '#44ddaa' : '#444'};
            opacity: ${known ? 1 : 0.55};
        `;
        el.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 4px;">${known ? entry.icon : '❓'}</div>
            <div style="font-weight: bold; font-size: 1.05em; margin-bottom: 4px;">${known ? entry.name : '???'}</div>
            <div style="font-size: 0.85em; color: #ccc; margin-bottom: 6px;">${known ? entry.flavor : 'Not yet cataloged. ' + entry.howTo}</div>
            ${known ? `<div style="font-size: 0.8em; color: #88ffcc;">${entry.memoryDesc}</div>` : ''}
        `;
        grid.appendChild(el);
    }

    container.querySelector('#close-bestiary')!.addEventListener('click', () => {
        container.remove();
        onClose();
    });

    return container;
}
