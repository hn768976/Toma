// ---------------------------------------------------------------------------
// Row content. Both sets live here so they are swappable from one file.
//
// Deliberately subject lines only: no sender names, no email addresses, no
// brands, no logos, no links. That is what the references show, and it keeps
// the clip clear of trademark issues and of anything resembling a usable
// phishing lure template.
//
// Each set holds exactly ROWS_PER_CYCLE (14) subjects, which is what makes the
// 420-frame scroll wrap seamlessly.
// ---------------------------------------------------------------------------

export type BadgeStyle = "none" | "alert";

export type RowSet = {
  /** Flag shown in brackets on every row. */
  flag: string;
  subjects: string[];
};

export const SPAM_ROWS: RowSet = {
  flag: "[*** Spam Mail ***]",
  subjects: [
    "Buy 3 get 1 free",
    "Welcome deal $100 off",
    "Over $300 Rewards Await You!",
    "Invest and win $250 dollars.",
    "Still looking? Get 50% off subscriptions",
    "−50% on all items",
    "Summer Sale. Don't miss out…",
    "Big save! Limited stock available.",
    "Last chance for you savings",
    "Buy 2 get 1 free",
    "Breaking news",
    "Get 30% off for 3 days only",
    "−25% on all items",
    "Congratulation You WIN 500$",
  ],
};

export const PHISHING_ROWS: RowSet = {
  flag: "[*** Phishing Mail ***]",
  subjects: [
    "Your bank account is locked",
    "Support Ticket Received #147095",
    "Suspicious activity on your account",
    "Payment Failed. Provide More Details",
    "Over $300 Rewards Await You!",
    "Update Your Payment Details",
    "attempt to hack your account",
    "Security alert for your account",
    "Congratulation You WIN 500$",
    "A high-extremity alert",
    "Tax return notification",
    "Invoice #115067. Action required.",
    "Verify your account",
    "Your password will expire",
  ],
};
