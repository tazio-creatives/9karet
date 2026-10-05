// The pincode delivery checker now does a real courier serviceability check
// (instead of only validating the format), so it's switched on for every
// existing product. Admin can still turn it off per product afterwards; new
// products default to on in the admin form.

export const up = (pgm) => {
  pgm.sql('UPDATE products SET show_delivery_checker = true WHERE show_delivery_checker = false;');
};

// One-way data change: which products had it off before isn't recorded, so
// there's nothing to restore.
export const down = () => {};
