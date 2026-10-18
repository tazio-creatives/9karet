// Shared contact/registered-business block for every policy page — one
// place to update if the address, email or CIN ever changes, rather than
// three copies drifting apart.
export function PolicyContact({ assistanceWith }: { assistanceWith: string }) {
  return (
    <>
      <p>
        For {assistanceWith}, please email us at{' '}
        <a href="mailto:info@9karet.com">info@9karet.com</a> or visit{' '}
        <a href="https://www.9karet.com">www.9karet.com</a>. Please keep your order number available when
        contacting our team.
      </p>
      <p>
        9Karet
        <br />
        Owned by Goldbox Diamonds Private Limited (CIN: U32111MH2025PTC458218)
        <br />
        No 281/287, 39 1-3, Narsi Natha Street, Princess Dock, Mumbai &ndash; 400009, Maharashtra
      </p>
    </>
  );
}
