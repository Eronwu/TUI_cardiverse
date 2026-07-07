export type StoryChapter = {
  id: string;
  title: string;
  lines: string[];
};

export const worldBackground: StoryChapter = {
  id: "world-background",
  title: "Terminal Cardiverse",
  lines: [
    "You are a Code Walker inside a damaged terminal substrate.",
    "Natural language is compiled into bounded executable intent.",
    "Every command spends RAM. Every overreach leaves a trace.",
    "The first anomaly is a boot residue named INIT ECHO."
  ]
};

export const initEchoStory: StoryChapter = {
  id: "init-echo",
  title: "INIT ECHO",
  lines: [
    "INIT: residual process detected.",
    "ECHO: checksum mismatch repeats across memory.",
    "The matrix answers every probe with the same broken boot question.",
    "Defeat it through shell damage or logic collapse."
  ]
};
