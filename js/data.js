/*
 * data.js — Lymphatic anatomy + Manual Lymphatic Drainage (MLD) guidance
 * ---------------------------------------------------------------------------
 * Coordinate system (world units, Three.js): Y up, +Z toward viewer (front),
 * X to the anatomical model's left = viewer's right is negative... we simply
 * treat +X as one side and -X as the other. Figure spans roughly y[-8, 8].
 *
 * Everything the 3D scene and the UI render is data-driven from this file so
 * the anatomy, pathways and instructions stay in one place.
 *
 * MEDICAL NOTE: This is an educational self-massage guide based on widely
 * taught MLD (Vodder/Casley-Smith style) principles. It is not a substitute
 * for a certified lymphedema therapist or a physician.
 */

export const PRINCIPLES = [
  {
    title: "Clear the drains first (proximal → distal)",
    text: "Lymph can only flow into a node cluster that has been emptied. Always stimulate the central 'drains' (neck terminus, then the region's main nodes) BEFORE working the limb that feeds them."
  },
  {
    title: "Feather-light pressure",
    text: "Lymphatic vessels sit just under the skin. Use only enough pressure to stretch the skin — about the weight of a coin (≈ 30 mmHg). Pressing hard collapses the vessels and does nothing."
  },
  {
    title: "Stretch, release, glide",
    text: "Each stroke is a slow skin-stretch in the drainage direction, then a passive release. Skin should move WITH your hand, not slide under it. Rhythm ≈ 1 stroke per second."
  },
  {
    title: "Follow the flow toward the heart",
    text: "All surface lymph ultimately empties at the venous angles behind the collarbones (the 'terminus'). Every stroke moves fluid toward the nearest node cluster and onward to that terminus."
  },
  {
    title: "Breathe — the deep pump",
    text: "Slow diaphragmatic breathing drives the thoracic duct and cisterna chyli. Deep belly breaths are part of the massage, not a warm-up."
  }
];

export const GLOBAL_BENEFITS = [
  "Reduces fluid retention, puffiness and swelling (oedema)",
  "Supports immune surveillance by moving lymph past the nodes",
  "Eases the feeling of heaviness in tired, swollen limbs",
  "Calms the nervous system — slow rhythmic strokes are parasympathetic",
  "Helps post-exercise and post-travel fluid clearance",
  "Adjunct comfort care in managed lymphedema (with a therapist's plan)"
];

/* Contraindications — shown prominently. Ordered roughly by urgency. */
export const PRECAUTIONS = [
  {
    level: "stop",
    title: "Fever or active infection",
    text: "Do not massage during an active infection, fever, or cellulitis in the area — you can help spread it. Wait until you have recovered."
  },
  {
    level: "stop",
    title: "Blood clots (DVT) or suspected clot",
    text: "Never massage over a known or suspected deep-vein thrombosis. A dislodged clot is a medical emergency. Get cleared by a doctor first."
  },
  {
    level: "stop",
    title: "Heart or kidney failure",
    text: "Congestive heart failure or renal failure means your body cannot handle the extra returning fluid. MLD is contraindicated unless a specialist directs it."
  },
  {
    level: "care",
    title: "Cancer / untreated lymphoma",
    text: "If you have or are being treated for cancer, only work with a certified lymphedema therapist and your oncologist. Do not self-treat over tumour sites or radiated fields without guidance."
  },
  {
    level: "care",
    title: "Pregnancy",
    text: "Skip deep abdominal work during pregnancy. Gentle limb and neck drainage is usually fine, but check with your midwife or doctor first."
  },
  {
    level: "care",
    title: "Skin problems",
    text: "Avoid open wounds, rashes, sunburn, active eczema or undiagnosed lumps. Never massage over an undiagnosed swelling or lump — get it checked."
  },
  {
    level: "tip",
    title: "Thyroid & carotid caution (neck)",
    text: "On the neck stay superficial and gentle. Avoid pressing on the pulse points at the front of the throat."
  },
  {
    level: "tip",
    title: "Hydrate & go easy",
    text: "Drink water afterwards. Stop if you feel dizzy, nauseous or unwell. More is not better — 10–20 minutes is plenty."
  }
];

/*
 * Node clusters. `side` of 0 = midline, ±1 = symmetric pair (built for both
 * sides automatically by mirroring X). `view` controls which camera face
 * shows it prominently. size is the glowing sphere radius.
 */
export const NODES = {
  // ---- FRONT ----
  terminus:      { label: "Terminus (supraclavicular)", pos: [0.85, 4.75, 0.95], size: 0.26, side: 1, view: "front", major: true },
  cervical_low:  { label: "Lower cervical chain",       pos: [0.72, 5.45, 0.78], size: 0.17, side: 1, view: "front" },
  cervical_up:   { label: "Upper cervical chain",       pos: [0.60, 5.95, 0.80], size: 0.17, side: 1, view: "front" },
  submandibular: { label: "Submandibular",              pos: [0.48, 6.35, 0.92], size: 0.15, side: 1, view: "front" },
  preauricular:  { label: "Pre-auricular (jaw/ear)",    pos: [0.92, 6.65, 0.55], size: 0.14, side: 1, view: "front" },
  axillary:      { label: "Axillary (armpit)",          pos: [1.72, 4.05, 0.55], size: 0.26, side: 1, view: "front", major: true },
  cubital:       { label: "Cubital (inner elbow)",      pos: [2.42, 1.95, 0.55], size: 0.16, side: 1, view: "front" },
  cisterna:      { label: "Cisterna chyli (deep abd.)", pos: [0.0,  2.15, 1.30], size: 0.24, side: 0, view: "front", major: true },
  abdominal:     { label: "Lower abdominal",            pos: [0.55, 1.35, 1.35], size: 0.15, side: 1, view: "front" },
  inguinal:      { label: "Inguinal (groin)",           pos: [0.92, 0.15, 1.05], size: 0.26, side: 1, view: "front", major: true },

  // ---- BACK ----
  occipital:     { label: "Occipital (skull base)",     pos: [0.55, 6.55, -0.85], size: 0.15, side: 1, view: "back" },
  post_cervical: { label: "Posterior cervical",         pos: [0.55, 5.75, -0.82], size: 0.16, side: 1, view: "back" },
  interscapular: { label: "Interscapular",              pos: [0.85, 3.65, -1.35], size: 0.16, side: 1, view: "back" },
  lumbar:        { label: "Lumbar",                     pos: [0.65, 1.55, -1.45], size: 0.16, side: 1, view: "back" },
  popliteal:     { label: "Popliteal (behind knee)",    pos: [1.00, -4.05, -0.80], size: 0.18, side: 1, view: "back" }
};

/*
 * Pathways are ordered point lists from DISTAL → TERMINUS. Flow particles and
 * the stroke arrow animate along this direction — which is exactly the
 * direction the user should stroke. `side` mirrors X like nodes.
 */
export const PATHWAYS = {
  neck_R: {
    side: 1, view: "front",
    points: [[0.92,6.65,0.55],[0.48,6.35,0.92],[0.60,5.95,0.80],[0.72,5.45,0.78],[0.85,4.75,0.95]]
  },
  arm_R: {
    side: 1, view: "front",
    points: [[2.55,-1.15,0.45],[2.50,0.55,0.55],[2.42,1.95,0.55],[2.05,3.15,0.65],[1.72,4.05,0.55],[0.85,4.75,0.95]]
  },
  trunk_center: {
    side: 0, view: "front",
    points: [[0.0,0.15,1.15],[0.0,1.35,1.35],[0.0,2.15,1.30],[0.0,3.45,1.20],[0.0,4.55,1.05]]
  },
  leg_R: {
    side: 1, view: "front",
    points: [[1.02,-7.75,0.75],[1.02,-7.10,0.70],[1.05,-5.50,0.90],[1.00,-4.05,0.92],[0.96,-2.10,1.05],[0.92,0.15,1.05],[0.55,1.35,1.35],[0.0,2.15,1.30]]
  },
  back_upper_R: {
    side: 1, view: "back",
    points: [[0.85,3.65,-1.35],[1.25,3.95,-1.05],[1.60,4.05,-0.55],[1.72,4.05,0.55]]
  },
  back_lower_R: {
    side: 1, view: "back",
    points: [[0.65,1.55,-1.45],[0.80,0.95,-1.10],[0.90,0.45,-0.30],[0.92,0.15,1.05]]
  },
  neck_back_R: {
    side: 1, view: "back",
    points: [[0.55,6.55,-0.85],[0.55,5.75,-0.82],[0.70,5.20,-0.40],[0.85,4.75,0.95]]
  }
};

/*
 * Drainage zones — the interactive units. Each references node & pathway ids,
 * a camera focus, benefits/precautions specific to the region, and an ordered
 * step list. `strokePath` points to a PATHWAYS key the stroke arrow rides;
 * `sub` = 'both' builds the stroke for both sides.
 */
export const ZONES = [
  {
    id: "terminus",
    name: "Neck Terminus",
    tag: "Start here — always",
    view: "front",
    color: 0x37e0c4,
    nodeIds: ["terminus"],
    pathwayIds: [],
    focus: { az: 0, el: 0.05, dist: 20, target: [0, 4.6, 0] },
    summary: "The supraclavicular hollows above your collarbones are where ALL body lymph finally empties. Opening them first creates suction for everything downstream.",
    benefits: ["Primes the whole system", "Relieves neck & sinus pressure", "Sets the calm, slow rhythm"],
    precautions: ["Stay light and superficial", "Avoid the pulsing artery at the front of the throat"],
    steps: [
      { title: "Find the hollows", instruction: "Place your fingertips flat in the soft hollows just above each collarbone, near the base of the neck.", duration: 15, reps: 0 },
      { title: "Pump inward & down", instruction: "Gently press the skin inward and downward toward the centre, then release. Skin stretches, no sliding. Rhythm: press–release once per second.", duration: 30, reps: 15, strokePath: "trunk_center", sub: "center" },
      { title: "Both sides", instruction: "Repeat on the opposite collarbone hollow. This is the 'drain' — you'll return here to finish every region.", duration: 30, reps: 15 }
    ]
  },
  {
    id: "neck",
    name: "Neck & Cervical Chain",
    tag: "Face, sinuses, head",
    view: "front",
    color: 0x4fd1ff,
    nodeIds: ["cervical_up", "cervical_low", "submandibular", "preauricular"],
    pathwayIds: ["neck_R"],
    focus: { az: 0, el: 0.1, dist: 18, target: [0, 5.6, 0] },
    summary: "Nodes run in a chain down each side of the neck, draining the face, scalp and sinuses down to the terminus.",
    benefits: ["Reduces facial puffiness & sinus congestion", "Eases tension headaches", "Brightens under-eye area"],
    precautions: ["Never press hard on the neck", "Skip if glands are swollen from an active infection"],
    steps: [
      { title: "Behind the ears", instruction: "Flat fingers behind the ears, stretch the skin gently downward toward the neck. Release. ×5.", duration: 20, reps: 5, strokePath: "neck_R", sub: "both" },
      { title: "Down the sides", instruction: "Both hands flat on the sides of the neck. Stretch skin downward toward the collarbones in slow 'J' strokes. ×10.", duration: 30, reps: 10, strokePath: "neck_R", sub: "both" },
      { title: "Under the jaw", instruction: "Sweep from the centre of the chin along the underside of the jaw toward the ear, then down the neck. ×5 each side.", duration: 30, reps: 5, strokePath: "neck_R", sub: "both" },
      { title: "Empty to terminus", instruction: "Finish with 5 gentle pumps in the collarbone hollows to clear everything you just moved.", duration: 15, reps: 5, strokePath: "trunk_center", sub: "center" }
    ]
  },
  {
    id: "axillary",
    name: "Armpit (Axillary)",
    tag: "Arm, chest & breast",
    view: "front",
    color: 0x7c9cff,
    nodeIds: ["axillary"],
    pathwayIds: [],
    focus: { az: 0.25, el: 0.05, dist: 20, target: [1.4, 4.0, 0] },
    summary: "The armpit nodes are the main drain for each arm, the chest wall and the breast. Pump them open before working the arm.",
    benefits: ["Drains arm & chest fluid", "Eases post-workout arm heaviness", "Common focus after breast surgery (with therapist guidance)"],
    precautions: ["Cleared with your surgeon if you've had node removal on that side", "Very light — this area is sensitive"],
    steps: [
      { title: "Cup the armpit", instruction: "Place the opposite hand flat into the hollow of the armpit, fingers wrapping slightly.", duration: 15, reps: 0 },
      { title: "Pump upward", instruction: "Gently press up and in toward the top of the armpit, then release. Once per second. ×15.", duration: 30, reps: 15 },
      { title: "Chest sweep to armpit", instruction: "Flat hand sweeps from the breastbone outward across the chest toward the same-side armpit. ×10.", duration: 30, reps: 10 },
      { title: "Switch sides", instruction: "Repeat on the other armpit and chest.", duration: 45, reps: 15 }
    ]
  },
  {
    id: "arm",
    name: "Arm",
    tag: "Hand → armpit",
    view: "front",
    color: 0x9d7cff,
    nodeIds: ["cubital", "axillary"],
    pathwayIds: ["arm_R"],
    focus: { az: 0.3, el: 0.0, dist: 22, target: [2.0, 2.0, 0] },
    summary: "Clear the armpit first, then move fluid up the arm in stages — upper arm before forearm before hand — so each segment drains into an emptied one above it.",
    benefits: ["Relieves swollen hands & fingers", "Helps after long flights or standing", "Reduces wrist & forearm puffiness"],
    precautions: ["Work top-down to open the path, then stroke bottom-up", "Stop if you feel numbness or pins & needles"],
    steps: [
      { title: "Open the armpit", instruction: "5 pumps in the armpit to make room (see Axillary).", duration: 15, reps: 5 },
      { title: "Upper arm", instruction: "Wrap the opposite hand around the upper arm and stretch the skin upward toward the armpit. ×7.", duration: 25, reps: 7, strokePath: "arm_R", sub: "both" },
      { title: "Elbow (cubital)", instruction: "Gently pump the soft inner-elbow crease, then stroke upward to the upper arm. ×7.", duration: 25, reps: 7, strokePath: "arm_R", sub: "both" },
      { title: "Forearm", instruction: "Stroke from wrist up the forearm toward the elbow. ×7.", duration: 25, reps: 7, strokePath: "arm_R", sub: "both" },
      { title: "Hand & fingers", instruction: "Milk each finger toward the hand, then stroke the back of the hand up to the wrist. ×5.", duration: 25, reps: 5, strokePath: "arm_R", sub: "both" },
      { title: "Long finish", instruction: "One long light sweep from hand all the way up to the armpit. ×5. Then switch arms.", duration: 30, reps: 5, strokePath: "arm_R", sub: "both" }
    ]
  },
  {
    id: "abdomen",
    name: "Abdomen & Deep Breathing",
    tag: "The deep pump",
    view: "front",
    color: 0x37e0c4,
    nodeIds: ["cisterna", "abdominal"],
    pathwayIds: ["trunk_center"],
    focus: { az: 0, el: -0.05, dist: 20, target: [0, 2.0, 0] },
    summary: "Deep diaphragmatic breathing pumps the cisterna chyli and thoracic duct — the body's largest lymph vessels. Combined with a gentle clockwise abdominal massage it clears the central highway.",
    benefits: ["Drives whole-body lymph return", "Eases bloating & sluggish digestion", "Deeply relaxing / vagal tone"],
    precautions: ["Skip deep abdominal work in pregnancy", "Avoid after recent abdominal surgery until cleared", "Not over a full stomach"],
    steps: [
      { title: "Belly breaths", instruction: "Hands on belly. Inhale slowly through the nose, letting the belly rise; exhale longer through the mouth. ×5 slow breaths.", duration: 40, reps: 5 },
      { title: "Clockwise circles", instruction: "Flat hands make slow, light circles around the navel in a CLOCKWISE direction (following the colon). ×10.", duration: 40, reps: 10 },
      { title: "Draw up the midline", instruction: "Stroke gently upward from the lower belly toward the ribs, encouraging fluid up toward the chest. ×8.", duration: 30, reps: 8, strokePath: "trunk_center", sub: "center" },
      { title: "Breathe to finish", instruction: "3 more deep breaths to pump everything upward to the terminus.", duration: 25, reps: 3 }
    ]
  },
  {
    id: "inguinal",
    name: "Groin (Inguinal)",
    tag: "Legs & lower body",
    view: "front",
    color: 0x4fd1ff,
    nodeIds: ["inguinal", "abdominal"],
    pathwayIds: [],
    focus: { az: 0.2, el: -0.1, dist: 20, target: [0.9, 0.2, 0] },
    summary: "The groin creases hold the main drain for each leg and the lower abdomen. Open them before working the legs.",
    benefits: ["Drains heavy, swollen legs", "Reduces ankle & lower-leg puffiness", "Supports pelvic fluid clearance"],
    precautions: ["Keep it light — nodes are close to the surface here", "Avoid over a hernia or recent groin surgery"],
    steps: [
      { title: "Find the crease", instruction: "Place flat hands in the crease where the top of the thigh meets the body.", duration: 15, reps: 0 },
      { title: "Pump inward & up", instruction: "Gently press the skin up and inward toward the centre, then release. ×15.", duration: 30, reps: 15 },
      { title: "Lower belly to groin", instruction: "Sweep from the lower belly down and out toward each groin crease. ×10.", duration: 30, reps: 10 },
      { title: "Both sides", instruction: "Make sure both groin creases are pumped and open before starting the leg.", duration: 20, reps: 10 }
    ]
  },
  {
    id: "leg",
    name: "Leg",
    tag: "Foot → groin",
    view: "front",
    color: 0x7c9cff,
    nodeIds: ["popliteal", "inguinal"],
    pathwayIds: ["leg_R"],
    focus: { az: 0.15, el: -0.25, dist: 24, target: [1.0, -3.5, 0] },
    summary: "After opening the groin, drain the leg top-down then stroke bottom-up: thigh, then knee (front & back), then calf, then foot — each into the emptied segment above.",
    benefits: ["Relieves tired, heavy, swollen legs", "Reduces ankle oedema from standing/flights", "Eases restless legs at night"],
    precautions: ["STOP if you suspect a clot: hot, red, painful calf — see a doctor", "Work upward toward the heart, never down"],
    steps: [
      { title: "Open the groin", instruction: "10 pumps in the groin crease first (see Groin).", duration: 20, reps: 10 },
      { title: "Thigh", instruction: "Both hands wrap the thigh and stretch the skin upward toward the groin. ×8.", duration: 30, reps: 8, strokePath: "leg_R", sub: "both" },
      { title: "Behind the knee", instruction: "Gently pump the soft hollow behind the knee (popliteal), then stroke up the thigh. ×7.", duration: 25, reps: 7, strokePath: "leg_R", sub: "both" },
      { title: "Calf", instruction: "Stroke firmly-but-lightly from ankle up the calf toward the knee. ×8.", duration: 30, reps: 8, strokePath: "leg_R", sub: "both" },
      { title: "Foot & ankle", instruction: "Stroke from the toes over the top of the foot up to the ankle. ×5.", duration: 25, reps: 5, strokePath: "leg_R", sub: "both" },
      { title: "Long finish", instruction: "One long sweep from foot to groin. ×5. Then switch legs.", duration: 30, reps: 5, strokePath: "leg_R", sub: "both" }
    ]
  },
  {
    id: "back",
    name: "Back (Posterior)",
    tag: "Rotate to back view",
    view: "back",
    color: 0x9d7cff,
    nodeIds: ["occipital", "post_cervical", "interscapular", "lumbar", "popliteal"],
    pathwayIds: ["back_upper_R", "back_lower_R", "neck_back_R"],
    focus: { az: Math.PI, el: 0.0, dist: 22, target: [0, 3.0, 0] },
    summary: "The back has a 'watershed': everything above the waist drains around to the armpits, everything below drains around to the groin. Stroke toward the front — you don't have to reach the middle of your own back to help it.",
    benefits: ["Eases upper-back & shoulder heaviness", "Supports lower-back fluid clearance", "Pairs well with the neck & groin work"],
    precautions: ["Use a partner or a soft ball against a wall if you can't reach", "Same light pressure applies on the back"],
    steps: [
      { title: "Skull base", instruction: "Fingertips at the base of the skull, stretch skin downward toward the neck. ×5.", duration: 20, reps: 5, strokePath: "neck_back_R", sub: "both" },
      { title: "Upper back → armpits", instruction: "Reach over the shoulders / to the sides and sweep the upper back skin toward the armpits. ×8.", duration: 30, reps: 8, strokePath: "back_upper_R", sub: "both" },
      { title: "Lower back → groin", instruction: "Hands on the lower back at the waist, sweep the skin around toward the front and the groin. ×8.", duration: 30, reps: 8, strokePath: "back_lower_R", sub: "both" },
      { title: "Clear the drains", instruction: "Finish with armpit pumps (upper) and groin pumps (lower) to receive the fluid.", duration: 25, reps: 10 }
    ]
  }
];

/*
 * The recommended full-body order for a complete self-MLD session. UI uses
 * this for the "Guided full session" mode. Order matters: drains first,
 * then feed them.
 */
export const SESSION_ORDER = ["terminus", "neck", "axillary", "arm", "abdomen", "inguinal", "leg", "back"];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
