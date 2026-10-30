export const messages = {
  bad_title: "Give the show a name, up to 60 characters.",
  bad_name: "Enter a name, up to 24 characters.",
  bad_device: "Refresh the page and try again.",
  limit: "You already have 3 shows on the wheel.",
  duplicate: "You already added that one.",
  locked: "The list is locked.",
  need_two: "Add at least two shows before locking.",
  not_found: "That night does not exist.",
  not_locked: "Lock the list before spinning.",
  not_yours: "Could not remove that show.",
  over: "This night is already over.",
  server: "Could not reach the database. Try again in a moment.",
} as const;

export type MessageKey = keyof typeof messages;
