// Condensed from CDC "Learn the Signs. Act Early." and AAP developmental guidance.
export type Category = "Movement" | "Social" | "Language" | "Cognitive";
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "Movement", label: "Movement / Physical" },
  { key: "Social", label: "Social / Emotional" },
  { key: "Language", label: "Language / Communication" },
  { key: "Cognitive", label: "Cognitive" },
];
export type Bracket = { id: string; label: string; maxMonths: number; items: Record<Category, string[]> };

export const BRACKETS: Bracket[] = [
  { id: "0-3", label: "0–3m", maxMonths: 3, items: {
    Movement: ["Holds head up during tummy time", "Moves both arms and legs", "Opens hands briefly"],
    Social: ["Calms down when spoken to or picked up", "Smiles when you talk or smile", "Looks at your face"],
    Language: ["Makes cooing sounds", "Reacts to loud sounds"],
    Cognitive: ["Watches you as you move", "Looks at a toy for several seconds"],
  } },
  { id: "4-6", label: "4–6m", maxMonths: 6, items: {
    Movement: ["Rolls from tummy to back", "Pushes up on straight arms", "Brings hands to mouth", "Holds a toy when placed in hand"],
    Social: ["Laughs", "Recognises familiar people", "Likes to look at self in a mirror"],
    Language: ["Takes turns making sounds with you", "Blows raspberries", "Makes squealing noises"],
    Cognitive: ["Reaches for a toy they want", "Puts things in mouth to explore", "Closes lips to show they don't want more food"],
  } },
  { id: "7-9", label: "7–9m", maxMonths: 9, items: {
    Movement: ["Sits without support", "Gets to a sitting position alone", "Moves things from one hand to the other"],
    Social: ["Is shy or clingy with strangers", "Shows several facial expressions", "Smiles or laughs at peek-a-boo"],
    Language: ["Makes sounds like \"mamamama\" and \"babababa\"", "Lifts arms up to be picked up", "Responds to own name"],
    Cognitive: ["Looks for objects when dropped out of sight", "Bangs two things together"],
  } },
  { id: "10-12", label: "10–12m", maxMonths: 12, items: {
    Movement: ["Pulls up to stand", "Walks holding on to furniture", "Picks things up with thumb and finger (pincer grasp)", "Drinks from a cup you hold"],
    Social: ["Plays games like pat-a-cake"],
    Language: ["Waves bye-bye", "Calls a parent \"mama\" or \"dada\"", "Understands \"no\""],
    Cognitive: ["Puts something in a container", "Looks for things they see you hide"],
  } },
  { id: "13-18", label: "13–18m", maxMonths: 18, items: {
    Movement: ["Walks without holding on", "Scribbles", "Feeds self with fingers", "Tries to use a spoon"],
    Social: ["Moves away but looks back to check you're close", "Points to show something interesting", "Helps dress self by pushing arm through sleeve"],
    Language: ["Says three or more words besides mama/dada", "Follows one-step directions without gestures"],
    Cognitive: ["Copies you doing chores", "Plays with toys in a simple way, like pushing a car"],
  } },
  { id: "19-24", label: "19–24m", maxMonths: 24, items: {
    Movement: ["Kicks a ball", "Runs", "Walks up a few stairs with or without help", "Eats with a spoon"],
    Social: ["Notices when others are hurt or upset", "Looks at your face to see how to react"],
    Language: ["Points to things in a book when asked", "Says at least two words together, like \"more milk\"", "Points to at least two body parts"],
    Cognitive: ["Holds something in one hand while using the other", "Tries to use switches, knobs or buttons", "Plays with more than one toy at once"],
  } },
  { id: "2-3y", label: "2–3y", maxMonths: 36, items: {
    Movement: ["Uses hands to twist things, like doorknobs", "Takes off some clothes alone", "Jumps off the ground with both feet", "Turns book pages one at a time"],
    Social: ["Plays next to and sometimes with other children", "Notices other children and joins their play", "Calms within 10 minutes after you leave"],
    Language: ["Talks in conversation with at least two back-and-forth exchanges", "Asks \"who\", \"what\", \"where\" or \"why\" questions", "Says first name when asked"],
    Cognitive: ["Draws a circle when shown how", "Avoids touching hot objects when warned", "Uses things to pretend, like feeding a doll"],
  } },
];

export const keyOf = (bracket: string, cat: Category, i: number) => `${bracket}:${cat}:${i}`;

export function labelOf(key: string): string | null {
  const [b, c, i] = key.split(":");
  return BRACKETS.find((x) => x.id === b)?.items[c as Category]?.[Number(i)] ?? null;
}

export function bracketForAge(birthDate: string | null | undefined, dateKind?: string | null): string {
  if (!birthDate || dateKind === "due") return BRACKETS[0]!.id;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return BRACKETS[0]!.id;
  const today = new Date();
  const months = Math.max(0, (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month - (today.getDate() < day ? 1 : 0));
  return (BRACKETS.find((b) => months <= b.maxMonths) ?? BRACKETS[BRACKETS.length - 1]!).id;
}
