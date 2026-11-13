import { PolicyDocLayout, type PolicySection } from './policies/PolicyDocLayout';

const SECTIONS: PolicySection[] = [
  {
    id: 'everyday-care',
    title: 'Everyday Jewellery Care',
    icon: 'sparkle',
    content: (
      <>
        <p>
          9K gold is harder-wearing than higher karats, but fine jewellery is not indestructible. Gold can scratch,
          delicate structures can bend, and stone settings can loosen when exposed to repeated impact.
        </p>
        <p>For everyday protection:</p>
        <ul>
          <li>Put your jewellery on after applying makeup, perfume, lotion, and hairspray.</li>
          <li>Remove jewellery before bathing, swimming, exercising, or sleeping.</li>
          <li>Avoid wearing jewellery while cooking, cleaning, gardening, or doing heavy work.</li>
          <li>Keep jewellery away from chlorine, bleach, detergents, sanitiser, and harsh chemicals.</li>
          <li>Do not pull chains, pendants, bracelets, or earrings forcefully.</li>
          <li>Avoid dropping jewellery onto hard surfaces.</li>
          <li>Check locks, clasps, and stone settings regularly.</li>
          <li>Handle ultra-lightweight jewellery carefully to maintain its shape.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cleaning-at-home',
    title: 'How to Clean Your Jewellery at Home',
    icon: 'drop',
    content: (
      <>
        <p>Everyday exposure to natural skin oils, soap, lotion, and dust can dull gold and gemstones.</p>
        <p>For gentle home cleaning:</p>
        <ol>
          <li>Fill a small bowl with lukewarm water.</li>
          <li>Add a few drops of mild liquid soap.</li>
          <li>Place the jewellery in the solution for approximately 10 to 15 minutes.</li>
          <li>Gently clean it using a very soft-bristled brush.</li>
          <li>Pay special attention to the back and underside of the stone setting.</li>
          <li>Rinse carefully with clean lukewarm water.</li>
          <li>Pat dry using a soft, lint-free cloth.</li>
          <li>Allow the jewellery to dry completely before storing it.</li>
        </ol>
        <p>
          <strong>Always clean jewellery inside a bowl.</strong> Do not rinse small items directly over an open sink or
          drain.
        </p>
        <p>
          Pieces set with pearls or emeralds should not be soaked — wipe them gently with a soft, damp cloth instead
          (see Caring for Gemstones below).
        </p>
      </>
    ),
  },
  {
    id: 'what-not-to-use',
    title: 'What Not to Use',
    icon: 'ban',
    content: (
      <>
        <p>Never clean fine jewellery using:</p>
        <ul>
          <li>Toothpaste</li>
          <li>Baking soda</li>
          <li>Bleach</li>
          <li>Chlorine</li>
          <li>Strong detergents</li>
          <li>Abrasive powders</li>
          <li>Hard-bristled brushes</li>
          <li>Metal-polishing products not approved for jewellery</li>
          <li>Household cleaning chemicals</li>
          <li>Boiling water</li>
        </ul>
        <p>
          These products may scratch the gold, weaken delicate settings, damage the finish, or discolour certain
          jewellery components.
        </p>
      </>
    ),
  },
  {
    id: 'ultra-lightweight',
    title: 'Caring for Ultra-Lightweight Jewellery',
    icon: 'feather',
    content: (
      <>
        <p>
          Lightweight pieces are designed for comfortable everyday wear. Because they use gold efficiently, they
          should be handled with extra care.
        </p>
        <ul>
          <li>Do not bend, twist, squeeze, or pull the jewellery.</li>
          <li>Avoid placing heavy objects over it.</li>
          <li>Hold pendants by their solid sections, not by delicate decorative areas.</li>
          <li>Open and close clasps gently.</li>
          <li>Never force a ring that does not fit.</li>
          <li>Store each piece in its original shape.</li>
          <li>Remove lightweight jewellery before sleeping or exercising.</li>
          <li>Seek professional assistance if the product becomes bent or misshapen.</li>
        </ul>
        <p>Do not attempt to reshape lightweight jewellery at home.</p>
      </>
    ),
  },
  {
    id: 'gemstones',
    title: 'Caring for Gemstones',
    icon: 'sparkle',
    content: (
      <>
        <p>
          Gemstones differ in hardness, so each needs a little different care. Sapphires and rubies are very hard and
          wear well every day; softer or treated stones need more gentleness.
        </p>
        <ul>
          <li>
            <strong>Ruby and sapphire:</strong> clean with mild soap and lukewarm water and a soft brush.
          </li>
          <li>
            <strong>Emerald:</strong> often treated to enhance clarity — wipe with a soft, damp cloth only. Avoid
            soaking, heat, and ultrasonic or steam cleaning.
          </li>
          <li>
            <strong>Pearl:</strong> put pearls on last and take them off first. Wipe with a soft cloth after wearing;
            keep them away from perfume, cosmetics, and water.
          </li>
          <li>
            <strong>Cubic zirconia:</strong> clean like ruby and sapphire, and store separately so harder stones do not
            scratch it.
          </li>
        </ul>
        <p>Store stone-set pieces separately so harder stones and gold do not scratch softer gemstones.</p>
      </>
    ),
  },
  {
    id: 'rings',
    title: 'Caring for Rings',
    icon: 'ring',
    content: (
      <>
        <p>Rings experience more daily contact than most jewellery.</p>
        <p>To protect your ring:</p>
        <ul>
          <li>Remove it before washing dishes, cleaning, exercising, or lifting heavy objects.</li>
          <li>Avoid striking the ring against walls, tables, gym equipment, or hard surfaces.</li>
          <li>Hold the ring by the band instead of touching the stone.</li>
          <li>Check that the stone does not move inside its setting.</li>
          <li>Do not force a tight ring onto or off your finger.</li>
          <li>Have frequently worn rings inspected periodically.</li>
        </ul>
        <p>
          If you notice movement, unusual sound, a bent prong, or a loose stone, stop wearing the ring and contact a
          jewellery professional.
        </p>
      </>
    ),
  },
  {
    id: 'earrings',
    title: 'Caring for Earrings',
    icon: 'earring',
    content: (
      <>
        <p>Earring posts, backs, hoops, clasps, and screws are small and require gentle handling.</p>
        <ul>
          <li>Secure screw backs properly without overtightening them.</li>
          <li>Check push backs before every use.</li>
          <li>Open and close hoops only through their intended mechanism.</li>
          <li>Do not bend earring posts.</li>
          <li>Store each earring pair together.</li>
          <li>Keep earrings away from perfume, hair products, and cosmetics.</li>
          <li>Clean the post and back regularly using an appropriate method.</li>
          <li>Remove earrings before sleeping, bathing, or swimming.</li>
        </ul>
        <p>For children’s earrings, parents should regularly check the fit and condition of the backs.</p>
      </>
    ),
  },
  {
    id: 'pendants-chains',
    title: 'Caring for Pendants and Chains',
    icon: 'link',
    content: (
      <>
        <p>Chains can become stretched, tangled, or damaged if they are pulled or stored incorrectly.</p>
        <ul>
          <li>Hold the clasp while putting on or removing the chain.</li>
          <li>Do not pull the pendant along a delicate chain.</li>
          <li>Store chains fastened and laid flat or gently suspended.</li>
          <li>Keep each chain in a separate pouch or compartment.</li>
          <li>Avoid wearing delicate chains while sleeping.</li>
          <li>Do not hang heavy pendants from chains not designed to support them.</li>
          <li>Check the clasp and connecting rings before wearing.</li>
        </ul>
        <p>
          If a chain becomes tangled, do not pull it forcefully. Place it on a flat surface and gently loosen the knot,
          or seek professional assistance.
        </p>
      </>
    ),
  },
  {
    id: 'bracelets',
    title: 'Caring for Bracelets',
    icon: 'bracelet',
    content: (
      <>
        <p>Bracelets are frequently exposed to friction from tables, watches, clothing, and daily activities.</p>
        <ul>
          <li>Keep stone-set bracelets separate from watches and hard bangles.</li>
          <li>Check the clasp before every use.</li>
          <li>Do not wear bracelets during exercise or physical work.</li>
          <li>Avoid pulling flexible sections beyond their intended movement.</li>
          <li>Store the bracelet flat and securely fastened.</li>
          <li>Inspect safety locks and connecting links regularly.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'childrens-jewellery',
    title: 'Caring for Children’s Jewellery',
    icon: 'child',
    content: (
      <>
        <p>Children’s jewellery must always be worn under responsible adult supervision.</p>
        <ul>
          <li>Ensure that the size and fit are appropriate.</li>
          <li>Remove jewellery before sleeping, bathing, swimming, sports, and active play.</li>
          <li>Inspect clasps, screws, chains, and settings frequently.</li>
          <li>Keep jewellery away from infants and young children when it is not being worn.</li>
          <li>Stop using the product if any part becomes loose, damaged, sharp, or misshapen.</li>
        </ul>
        <p>
          <strong>
            Jewellery contains small components and may present a choking or safety risk if damaged or used without
            supervision.
          </strong>
        </p>
      </>
    ),
  },
  {
    id: 'yellow-gold',
    title: 'Yellow-Gold Jewellery Care',
    icon: 'coin',
    content: (
      <>
        <p>Yellow gold can develop small scratches through regular wear.</p>
        <ul>
          <li>Clean it gently with mild soap and lukewarm water.</li>
          <li>Wipe it using a soft, lint-free cloth.</li>
          <li>Store it separately from stone-set and harder jewellery.</li>
          <li>Avoid abrasive polishing materials.</li>
          <li>Use professional polishing only when necessary, as polishing removes a small amount of metal.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rose-gold',
    title: 'Rose-Gold Jewellery Care',
    icon: 'coin',
    content: (
      <>
        <p>Rose gold receives its warm colour from its metal composition and may develop a natural character over time.</p>
        <ul>
          <li>Keep it away from strong chemicals.</li>
          <li>Avoid abrasive cleaning products.</li>
          <li>Clean it using mild soap and lukewarm water.</li>
          <li>Store it separately to prevent scratches.</li>
          <li>Seek professional advice before polishing or refinishing.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'white-gold',
    title: 'White-Gold Jewellery Care',
    icon: 'coin',
    content: (
      <>
        <p>White gold may be finished with a surface coating that can gradually wear with regular use.</p>
        <ul>
          <li>Avoid harsh chemicals and abrasive cleaning.</li>
          <li>Store it away from harder jewellery.</li>
          <li>Have the finish professionally inspected if the colour appears to change.</li>
          <li>Do not attempt to restore or recoat white gold at home.</li>
          <li>Periodic professional refinishing may be required depending on wear.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Proper Jewellery Storage',
    icon: 'archive',
    content: (
      <>
        <p>Correct storage helps prevent scratching, tangling, bending, and accidental loss.</p>
        <p>We recommend:</p>
        <ul>
          <li>Using the original 9Karet jewellery box or a soft-lined organiser.</li>
          <li>Storing each item in a separate compartment.</li>
          <li>Fastening chains and bracelets before storage.</li>
          <li>Keeping jewellery in a cool, dry location.</li>
          <li>Avoiding prolonged exposure to direct sunlight, heat, or humidity.</li>
          <li>Keeping stone-set pieces separate from other jewellery, because hard stones can scratch gold and softer gemstones.</li>
          <li>Placing small earrings and backs in secure compartments.</li>
          <li>Keeping jewellery away from bathrooms and other damp environments.</li>
        </ul>
        <p>Before storing, make sure the jewellery is clean and completely dry.</p>
      </>
    ),
  },
  {
    id: 'travelling',
    title: 'Travelling With Jewellery',
    icon: 'briefcase',
    content: (
      <>
        <p>When travelling:</p>
        <ul>
          <li>Carry jewellery in a secure, padded travel case.</li>
          <li>Store every item separately.</li>
          <li>Avoid placing loose jewellery inside handbags or luggage.</li>
          <li>Keep valuable pieces in your hand luggage when permitted.</li>
          <li>Do not leave jewellery unattended in hotel rooms or vehicles.</li>
          <li>Check clasps, screws, and settings before and after travel.</li>
          <li>Carry purchase invoices and certificates safely when necessary.</li>
          <li>Consider appropriate insurance for high-value jewellery.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'professional-inspection',
    title: 'Professional Inspection and Servicing',
    icon: 'search',
    content: (
      <>
        <p>Even carefully maintained jewellery may need professional attention over time.</p>
        <p>
          Consider having frequently worn jewellery inspected periodically, especially engagement rings, bracelets,
          earrings, and delicate chains.
        </p>
        <p>A professional inspection may include:</p>
        <ul>
          <li>Checking stone settings</li>
          <li>Examining prongs and claws</li>
          <li>Testing clasps and locks</li>
          <li>Inspecting chains and connecting rings</li>
          <li>Checking for bending or distortion</li>
          <li>Professional cleaning</li>
          <li>Polishing or refinishing</li>
          <li>Reviewing the overall condition</li>
        </ul>
        <p>
          The recommended servicing frequency depends on how often the jewellery is worn and the conditions in which it
          is used.
        </p>
      </>
    ),
  },
  {
    id: 'when-to-stop',
    title: 'When to Stop Wearing Your Jewellery',
    icon: 'alert',
    content: (
      <>
        <p>Stop wearing the product and seek professional assistance if you notice:</p>
        <ul>
          <li>A loose or moving stone</li>
          <li>A missing stone</li>
          <li>A bent or broken prong</li>
          <li>A damaged clasp or lock</li>
          <li>A stretched or broken chain</li>
          <li>A sharp edge</li>
          <li>A visible crack</li>
          <li>A distorted ring or bracelet</li>
          <li>Unusual movement or clicking sounds</li>
          <li>Significant discolouration</li>
          <li>Skin irritation</li>
        </ul>
        <p>
          Continuing to wear damaged jewellery may make the problem worse or lead to the loss of a stone or
          component.
        </p>
      </>
    ),
  },
  {
    id: 'ultrasonic-steam',
    title: 'Ultrasonic and Steam Cleaning',
    icon: 'wave',
    content: (
      <>
        <p>Ultrasonic and steam cleaners are not suitable for every type of jewellery.</p>
        <p>
          They may affect delicate, lightweight, damaged, pavé-set, enamelled, treated, or multi-material jewellery.
          They can damage treated stones such as emeralds, and may cause an already loose stone to fall from its
          setting.
        </p>
        <p>
          Do not use ultrasonic or steam-cleaning equipment unless a qualified jewellery professional has confirmed
          that it is safe for the specific product.
        </p>
      </>
    ),
  },
  {
    id: 'care-checklist',
    title: 'Jewellery Care Checklist',
    icon: 'checklist',
    content: (
      <>
        <h3>After Every Wear</h3>
        <ul>
          <li>Wipe the jewellery gently with a soft cloth.</li>
          <li>Check the clasp, screw, or lock.</li>
          <li>Store the item separately.</li>
          <li>Keep it away from moisture and chemicals.</li>
        </ul>
        <h3>Every Few Weeks</h3>
        <ul>
          <li>Clean regularly worn jewellery using a gentle method.</li>
          <li>Inspect the setting for movement or damage.</li>
          <li>Check chains and connecting rings.</li>
          <li>Examine frequently used clasps and earring backs.</li>
        </ul>
        <h3>Periodically</h3>
        <ul>
          <li>Arrange a professional inspection for frequently worn jewellery.</li>
          <li>Request professional cleaning when required.</li>
          <li>Repair damage before wearing the item again.</li>
          <li>Review insurance and valuation documents for high-value pieces.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'care-disclaimer',
    title: 'Important Care Disclaimer',
    icon: 'scale',
    content: (
      <>
        <p>
          Care requirements may vary according to the product’s design, construction, gemstones, stone setting,
          enamel, and other materials.
        </p>
        <p>
          Home cleaning and care are performed at the customer’s discretion. If you are unsure about the correct
          method, contact 9Karet before cleaning or attempting to repair the product.
        </p>
        <p>
          Repairs, alterations, resizing, polishing, or servicing performed by an unauthorised third party may affect
          the product’s condition and applicable service eligibility.
        </p>
      </>
    ),
  },
  {
    id: 'need-assistance',
    title: 'Need Assistance?',
    icon: 'mail',
    content: (
      <>
        <p>
          If your jewellery requires inspection, cleaning, repair, resizing, or care guidance, please contact the
          9Karet customer-support team before sending the product.
        </p>
        <p>
          Keep your invoice, certificate, packaging, and relevant product information available when requesting
          assistance.
        </p>
        <p>
          Email <a href="mailto:info@9karet.com">info@9karet.com</a> for support and additional information.
        </p>
        <p>
          <strong>9Karet — Timeless by Nature.</strong>
          <br />
          Care for every detail. Protect every memory.
        </p>
      </>
    ),
  },
];

export function CareGuidePage() {
  return (
    <PolicyDocLayout
      title="Jewellery Care Guide"
      breadcrumbSection="Customer Care"
      lastUpdated="2 October 2026"
      subtitle={
        <>
          Keep your 9Karet jewellery beautiful for years.
          <br />
          Simple care for lasting shine and brilliance.
        </>
      }
      glance={{
        heading: 'Keep Your Jewellery Beautiful for Years',
        content: (
          <>
            <p>
              Fine jewellery is designed to last, but it still requires thoughtful care. Regular cleaning, proper
              storage, and careful handling can protect the shine of your gold, preserve the colour of your
              gemstones, and reduce the risk of damage.
            </p>
            <p>Follow this guide to keep your 9Karet jewellery looking its best.</p>
          </>
        ),
      }}
      sections={SECTIONS}
    />
  );
}
