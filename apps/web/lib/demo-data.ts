import type { GameVersion, Participant, ParticipantProgress, ParticipantStepProgress, JamDetail } from "@game-game/shared";

export const demoVersion: GameVersion = {
  id: "ver_demo",
  gameId: "game_demo",
  versionNumber: 1,
  createdAt: new Date().toISOString(),
  createdBy: "admin_demo",
  isPublishedVersion: true,
  snapshotJson: {
    game: {
      id: "game_demo",
      organizationId: "org_demo",
      isTemplate: false,
      slug: "cyber-racer",
      title: "Cyber Racer Mission",
      shortDescription: "Build a mini racing mission with a clear start and finish.",
      fullDescription: "Demo mission used as a fallback payload for local UI rendering.",
      themeCode: "cyber-it",
      level: "beginner",
      estimatedDurationMin: 45,
      coverImageUrl: "",
      previewVideoUrl: "",
      accentStyle: "neon-grid",
      accentColor: "#8B5CF6",
      finalTitle: "Mission Complete",
      finalDescription: "Show the trainer what you built.",
      finalRewardXp: 120,
      status: "published",
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin_demo",
      updatedBy: "admin_demo"
    },
    steps: [
      {
        id: "step_1",
        gameId: "game_demo",
        orderIndex: 1,
        title: "Create the scene",
        description: "Add the background and the player.",
        goalText: "The player can see the mission start.",
        successTitle: "Scene ready",
        successText: "The game has a clear starting point.",
        successXp: 20,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hints: [
          { id: "hint_1", stepId: "step_1", level: 1, text: "Start from a blank scene.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_2", stepId: "step_1", level: 2, text: "Place the player on the scene.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_3", stepId: "step_1", level: 3, text: "Make sure the player is visible.", hintType: "text", createdAt: "", updatedAt: "" }
        ]
      },
      {
        id: "step_2",
        gameId: "game_demo",
        orderIndex: 2,
        title: "Add controls",
        description: "Wire left and right movement.",
        goalText: "The player reacts to the keyboard.",
        successTitle: "Controls enabled",
        successText: "The game now responds to the player.",
        successXp: 20,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hints: [
          { id: "hint_4", stepId: "step_2", level: 1, text: "Listen to keyboard events.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_5", stepId: "step_2", level: 2, text: "Move the player by changing x.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_6", stepId: "step_2", level: 3, text: "Keep the player inside the scene bounds.", hintType: "text", createdAt: "", updatedAt: "" }
        ]
      },
      {
        id: "step_3",
        gameId: "game_demo",
        orderIndex: 3,
        title: "Add obstacles",
        description: "Place something to avoid on the track.",
        goalText: "The player now has a challenge.",
        successTitle: "Obstacles live",
        successText: "The mission is ready for a finish line.",
        successXp: 30,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hints: [
          { id: "hint_7", stepId: "step_3", level: 1, text: "Start with one obstacle.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_8", stepId: "step_3", level: 2, text: "Add collision detection.", hintType: "text", createdAt: "", updatedAt: "" },
          { id: "hint_9", stepId: "step_3", level: 3, text: "Try multiple obstacles with different spacing.", hintType: "text", createdAt: "", updatedAt: "" }
        ]
      }
    ],
    finalScreen: {
      title: "Mission Complete",
      description: "Show the trainer your game.",
      rewardXp: 120
    }
  }
};

export const demoParticipant: Participant = {
  id: "participant_demo",
  jamId: "jam_demo",
  displayName: "Alice",
  avatar: "robot",
  status: "active",
  joinedAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString()
};

export const demoProgress: ParticipantProgress = {
  id: "progress_demo",
  participantId: "participant_demo",
  gameVersionId: "ver_demo",
  currentStepId: "step_2",
  completedStepsCount: 1,
  totalStepsCount: 3,
  xpTotal: 20,
  isCompleted: false,
  startedAt: new Date().toISOString()
};

export const demoStepProgress: ParticipantStepProgress[] = [
  {
    id: "step_progress_1",
    participantId: "participant_demo",
    gameVersionId: "ver_demo",
    stepId: "step_1",
    status: "completed",
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    hintsOpenedCount: 1,
    lastHintLevelOpened: 1,
    needsHelpFlag: false
  },
  {
    id: "step_progress_2",
    participantId: "participant_demo",
    gameVersionId: "ver_demo",
    stepId: "step_2",
    status: "active",
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    hintsOpenedCount: 0,
    lastHintLevelOpened: 0,
    needsHelpFlag: false
  },
  {
    id: "step_progress_3",
    participantId: "participant_demo",
    gameVersionId: "ver_demo",
    stepId: "step_3",
    status: "locked",
    hintsOpenedCount: 0,
    lastHintLevelOpened: 0,
    needsHelpFlag: false
  }
];

export const demoJamDetail: JamDetail = {
  jam: {
    id: "jam_demo",
    organizationId: "org_demo",
    title: "Saturday Mini Jam",
    joinCode: "CYBER7",
    joinUrl: "/join/CYBER7",
    status: "active",
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: "trainer_demo"
  },
  jamGames: [
    {
      id: "jam_game_1",
      jamId: "jam_demo",
      gameVersionId: "ver_demo",
      isDefault: true,
      orderIndex: 1
    }
  ],
  participants: [
    {
      participant: demoParticipant,
      gameTitle: demoVersion.snapshotJson.game.title,
      currentStepTitle: "Add controls",
      progressPercent: 33,
      hintsOpenedCount: 2,
      lastActivityAt: new Date().toISOString()
    },
    {
      participant: {
        ...demoParticipant,
        id: "participant_2",
        displayName: "Max",
        status: "needs_help"
      },
      gameTitle: demoVersion.snapshotJson.game.title,
      currentStepTitle: "Add obstacles",
      progressPercent: 66,
      hintsOpenedCount: 3,
      lastActivityAt: new Date().toISOString()
    }
  ]
};
