export type Phase = "open" | "locked" | "complete";

export type ShowView = {
  id: string;
  title: string;
  mine: boolean;
  eliminated: boolean;
  eliminationOrder: number | null;
  addedBy: string | null;
  fill: string;
  ink: string;
};

export type SessionView = {
  code: string;
  status: Phase;
  createdAt: string;
  completedAt: string | null;
  serverNow: number;
  spinWindowMs: number;
  spinAnimMs: number;
  you: { name: string; showCount: number } | null;
  participants: { name: string }[];
  shows: ShowView[];
  activeSpin: null | {
    showId: string;
    spinSeq: number;
    startedAt: number;
  };
  winner: null | {
    showId: string;
    title: string;
    addedBy: string;
  };
};

export type HistoryNight = {
  code: string;
  createdAt: string;
  completedAt: string | null;
  winnerTitle: string;
  addedBy: string;
};
