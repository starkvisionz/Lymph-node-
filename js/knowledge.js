/*
 * knowledge.js — the lymph-node knowledge base.
 *
 * Two things live here:
 *   NODE_INFO  — per-cluster clinical/anatomy detail (keyed by NODES key), shown
 *                inside a selected zone's panel.
 *   KB         — the "Learn" hub content: node anatomy (with an SVG diagram),
 *                the lymphatic system, a regional drainage reference, guidance on
 *                swollen nodes, an FAQ and a glossary.
 *
 * Educational content, medically reviewed against standard anatomy/clinical
 * references. Not a diagnostic tool — see the safety tab and disclaimers.
 */

/* ---- per-cluster detail (keyed to NODES) ---- */
export const NODE_INFO = {
  terminus: {
    title: "Terminus / supraclavicular",
    drains: "The final exit for ALL body lymph",
    count: "Deep nodes over each venous angle",
    note: "Where the thoracic duct (left) and right lymphatic duct empty lymph back into the bloodstream at the subclavian veins. Clearing it first creates the 'suction' for everything downstream. Clinical note: a hard, fixed left supraclavicular node (Virchow's node) can signal abdominal/thoracic disease and warrants prompt review."
  },
  cervical_up:   { title: "Upper cervical chain", drains: "Scalp, ear, throat, tonsils", count: "Part of ~300 nodes in the neck", note: "Along the internal jugular vein. These are the glands that swell with sore throats and colds — usually tender and mobile when reactive." },
  cervical_low:  { title: "Lower cervical chain", drains: "Larynx, thyroid, lower neck", count: "Deep jugular group", note: "Feeds downward into the terminus. Keep pressure feather-light over the neck." },
  submandibular: { title: "Submandibular", drains: "Mouth, gums, cheeks, nose, lips", count: "3–6 nodes under the jaw", note: "Commonly enlarge with dental and mouth infections." },
  preauricular:  { title: "Pre-auricular", drains: "Eyelids, temple, ear, cheek", count: "In front of the ear", note: "Enlarge with eye infections (e.g. conjunctivitis) and scalp conditions." },
  axillary:      { title: "Axillary (armpit)", drains: "Arm, chest wall, breast, upper back", count: "20–40 nodes per side", note: "Central to breast-cancer staging — the sentinel node is the first axillary node a tumour drains to. Work very gently, and get clearance first if you've had nodes removed on that side." },
  cubital:       { title: "Cubital (inner elbow)", drains: "Little-finger side of the hand & forearm", count: "1–2 nodes (epitrochlear)", note: "An enlarged epitrochlear node is a useful clue to hand infections or, rarely, systemic illness." },
  cisterna:      { title: "Cisterna chyli", drains: "Legs, pelvis, abdomen & the gut", count: "A sac at the L1–L2 vertebrae", note: "The dilated origin of the thoracic duct. It also collects fat-rich 'chyle' absorbed from the intestines. Deep diaphragmatic breathing is what pumps it." },
  abdominal:     { title: "Lower abdominal / iliac", drains: "Pelvis and lower abdominal wall", count: "Along the great vessels", note: "Deep nodes — reached indirectly through breathing and gentle abdominal work, not direct pressure." },
  inguinal:      { title: "Inguinal (groin)", drains: "Leg, buttock, lower abdominal wall, external genitalia", count: "~10 superficial + deep nodes", note: "The main drain for the whole leg. Mildly enlarged inguinal nodes are common and often harmless, but a new hard or growing node should be checked." },
  occipital:     { title: "Occipital", drains: "Back of the scalp", count: "At the skull base", note: "Often palpable with scalp irritation or infection." },
  post_cervical: { title: "Posterior cervical", drains: "Scalp & neck (posterior)", count: "Behind the sternocleidomastoid", note: "Classically enlarge in glandular fever (mononucleosis)." },
  interscapular: { title: "Interscapular / posterior", drains: "Upper back — routes to the axilla", count: "Superficial drainage field", note: "The upper back's watershed drains around to the armpits, not straight down." },
  lumbar:        { title: "Lumbar", drains: "Lower back — routes to the groin", count: "Superficial drainage field", note: "Below the waistline the back drains around to the groin." },
  popliteal:     { title: "Popliteal (behind knee)", drains: "Heel and back of the lower leg", count: "Deep in the knee hollow", note: "A gentle relay station on the leg's route up to the groin." }
};

/* ---- inline SVG: stylised cross-section of a lymph node ---- */
function nodeDiagram() {
  return `
  <svg viewBox="0 0 420 260" role="img" aria-label="Cross-section of a lymph node" class="kb-diagram">
    <defs>
      <radialGradient id="kbCortex" cx="55%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#123540"/>
        <stop offset="100%" stop-color="#0b232b"/>
      </radialGradient>
    </defs>
    <!-- afferent vessels in -->
    <g stroke="#4fd1ff" stroke-width="3" fill="none" opacity="0.8">
      <path d="M20,70 H95"/><path d="M20,120 H90"/><path d="M20,170 H95"/>
      <polygon points="95,70 86,65 86,75" fill="#4fd1ff" stroke="none"/>
      <polygon points="90,120 81,115 81,125" fill="#4fd1ff" stroke="none"/>
      <polygon points="95,170 86,165 86,175" fill="#4fd1ff" stroke="none"/>
    </g>
    <!-- capsule + body -->
    <path d="M110,40 C210,10 330,30 360,110 C378,160 320,235 220,232 C120,229 78,150 110,40 Z"
          fill="url(#kbCortex)" stroke="#2f8a9c" stroke-width="3"/>
    <!-- follicles (cortex) -->
    <g fill="#37e0c4" opacity="0.85">
      <circle cx="165" cy="80" r="16"/><circle cx="205" cy="66" r="13"/>
      <circle cx="250" cy="82" r="15"/><circle cx="150" cy="120" r="12"/>
      <circle cx="290" cy="120" r="12"/>
    </g>
    <!-- paracortex -->
    <ellipse cx="220" cy="140" rx="70" ry="42" fill="#1a4a56" opacity="0.6"/>
    <!-- medulla (cords toward hilum) -->
    <g stroke="#8ff0e0" stroke-width="2.5" fill="none" opacity="0.7">
      <path d="M250,175 Q300,185 340,150"/><path d="M235,190 Q300,205 345,165"/>
    </g>
    <!-- efferent vessel out at hilum -->
    <path d="M345,155 C380,150 392,165 405,158" stroke="#ffd166" stroke-width="3.5" fill="none"/>
    <polygon points="405,158 396,153 396,163" fill="#ffd166"/>
    <!-- labels -->
    <g font-size="11" fill="#9fc0c7" font-family="inherit">
      <text x="16" y="58">Afferent vessels (in)</text>
      <text x="150" y="52">Cortex · B-cell follicles</text>
      <text x="176" y="150" fill="#cfe9ec">Paracortex · T cells</text>
      <text x="300" y="205">Medulla</text>
      <text x="320" y="140" fill="#ffd166">Efferent (out) · hilum</text>
    </g>
  </svg>`;
}

/* ---- the Learn hub ---- */
export const KB = {
  nodes: {
    title: "Lymph nodes 101",
    lead: "Lymph nodes are small bean-shaped filters — a few hundred of them, clustered along the lymph vessels. Lymph fluid trickles in, immune cells inspect it for microbes and abnormal cells, and cleaned fluid drains onward toward the heart.",
    html: `
      ${nodeDiagram()}
      <h4>Inside a node</h4>
      <ul class="kb-list">
        <li><strong>Afferent vessels</strong> bring lymph <em>in</em> across the convex surface.</li>
        <li><strong>Cortex</strong> holds B-cell <em>follicles</em>; their germinal centres enlarge (and the node swells) during an active response.</li>
        <li><strong>Paracortex</strong> is packed with T cells and specialised vessels (HEVs) that recruit them.</li>
        <li><strong>Medulla</strong> contains macrophages and antibody-secreting plasma cells.</li>
        <li><strong>Efferent vessel</strong> carries filtered lymph <em>out</em> at the <strong>hilum</strong>, alongside the artery and vein.</li>
      </ul>
      <p>Typical nodes are 0.1–2.5 cm. When you feel "swollen glands," you're feeling nodes working overtime — usually a normal, temporary reaction to a nearby infection.</p>`
  },
  system: {
    title: "The lymphatic system",
    lead: "A one-way drainage network running alongside your blood vessels. It has no central pump — it moves on muscle contraction, breathing, arterial pulsation and the vessels' own rhythmic squeeze.",
    html: `
      <h4>From tissue back to blood</h4>
      <p>Tiny lymph capillaries collect the fluid, protein and waste that leaks out of blood capillaries (~2–3 litres a day). Collecting vessels with one-way valves carry it through nodes and up into two great ducts:</p>
      <ul class="kb-list">
        <li><strong>Right lymphatic duct</strong> — drains the right head &amp; neck, right arm and right chest into the right venous angle.</li>
        <li><strong>Thoracic duct</strong> — drains <em>everything else</em>. It begins at the <strong>cisterna chyli</strong> (around L1–L2), climbs through the chest, and empties at the left venous angle.</li>
      </ul>
      <p>Both empty at the <strong>terminus</strong> behind the collarbones — which is exactly why MLD always starts there. The gut also feeds fat-rich <em>chyle</em> into this system via intestinal lacteals.</p>
      <h4>What moves the lymph</h4>
      <p>Skeletal-muscle "milking," the pressure swings of deep breathing, arterial pulsation, and contraction of the vessel segments themselves (lymphangions). Light skin-stretch strokes add to that — heavy pressure does not.</p>`
  },
  regions: {
    title: "Node regions & what they drain",
    lead: "A quick reference for where each cluster sits and the territory it clears.",
    table: [
      ["Cervical (neck)", "Scalp, face, sinuses, throat, thyroid", "→ terminus"],
      ["Submandibular", "Mouth, gums, lips, nose", "→ cervical → terminus"],
      ["Supraclavicular / terminus", "Whole body (final exit)", "→ bloodstream"],
      ["Axillary (armpit)", "Arm, chest wall, breast, upper back", "→ terminus"],
      ["Cubital (elbow)", "Little-finger side of hand/forearm", "→ axillary"],
      ["Cisterna chyli / abdominal", "Legs, pelvis, gut", "→ thoracic duct"],
      ["Inguinal (groin)", "Leg, buttock, lower abdomen, genitalia", "→ abdominal → terminus"],
      ["Popliteal (knee)", "Heel, back of lower leg", "→ inguinal"],
    ]
  },
  swollen: {
    title: "Swollen nodes — what's normal?",
    lead: "Most swollen nodes are 'reactive' — temporarily busy fighting a nearby infection. A few features are worth a doctor's eye.",
    html: `
      <h4>Usually reassuring</h4>
      <ul class="kb-list">
        <li>Small (under ~1 cm; groin nodes can normally be a little larger)</li>
        <li>Soft, tender, and <strong>mobile</strong> under the skin</li>
        <li>Appears with a cold, sore throat or nearby infection, and settles within 2–4 weeks</li>
      </ul>
      <h4 class="warn">See a clinician if a node is…</h4>
      <ul class="kb-list warn">
        <li>Hard, <strong>fixed</strong> in place, or painless and growing</li>
        <li>Larger than ~2 cm, or persisting beyond 3–4 weeks</li>
        <li>Any swollen node <strong>above the collarbone</strong> (supraclavicular)</li>
        <li>With night sweats, unexplained weight loss, or persistent fever</li>
        <li>Swelling of a whole limb, or many node areas at once</li>
      </ul>
      <p class="kb-note">Massage is for fluid movement, not for treating a lump. Never massage over an undiagnosed, infected or painful node — get it assessed first.</p>`
  },
  faq: {
    title: "FAQ",
    items: [
      ["How hard should I press?", "Barely. Lymph vessels sit just under the skin; use about the weight of a coin and stretch the skin rather than sliding over it. Heavy pressure collapses the vessels."],
      ["How long and how often?", "10–20 minutes is plenty. Once or twice a day is reasonable for general puffiness; follow a therapist's plan for managed lymphedema."],
      ["Will it 'flush toxins'?", "Not in the detox-marketing sense. It genuinely helps move fluid, protein and immune cells — which reduces swelling and that heavy feeling — but it isn't a cleanse."],
      ["Can I massage a swollen gland?", "Not if it's from an active infection, and never an undiagnosed lump. Wait until you've recovered or been assessed."],
      ["Why start at the neck if my ankle is swollen?", "You have to open the drains before you fill them. Clearing the neck terminus and then the groin creates room for fluid moved up from the leg."],
      ["Is the tingling/urge to pee afterward normal?", "A mild need to urinate is common — you've moved fluid back toward the circulation. Stop if you feel dizzy or unwell, and drink water."]
    ]
  },
  glossary: {
    title: "Glossary",
    items: [
      ["Lymph", "Clear fluid drained from body tissues, carrying protein, waste and immune cells."],
      ["Lymphatic vessel", "One-way channel with valves that carries lymph toward the heart."],
      ["Lymphangion", "The segment of vessel between two valves; it contracts rhythmically to pump lymph."],
      ["Node (lymph node)", "Bean-shaped filter where immune cells inspect lymph."],
      ["Afferent / efferent", "Vessels carrying lymph into / out of a node."],
      ["Terminus", "The supraclavicular exit points where lymph rejoins the bloodstream."],
      ["Cisterna chyli", "Sac at the base of the thoracic duct, in the upper abdomen."],
      ["Thoracic duct", "The body's main lymph vessel, draining everything except the right upper quadrant."],
      ["Watershed", "A boundary line separating regions that drain to different node groups."],
      ["Oedema / lymphedema", "Swelling from fluid build-up; lymphedema is specifically from impaired lymph drainage."],
      ["MLD", "Manual Lymphatic Drainage — the light, rhythmic technique this guide teaches."],
      ["Sentinel node", "The first node a region (or tumour) drains to; sampled in cancer staging."]
    ]
  }
};

/* Tab order for the Learn hub (safety/how-it-works are appended by the UI). */
export const KB_TABS = ["overview", "nodes", "system", "regions", "swollen", "faq", "glossary", "safety"];
