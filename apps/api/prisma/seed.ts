import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/common/password.js";

const prisma = new PrismaClient();

async function main() {
  const defaultOrganization = await prisma.organization.upsert({
    where: { slug: "default-school" },
    update: {
      name: "Default School",
      isActive: true
    },
    create: {
      name: "Default School",
      slug: "default-school",
      isActive: true
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      displayName: "Admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      isActive: true
    },
    create: {
      email: "admin@example.com",
      displayName: "Admin",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      isActive: true
    }
  });

  const trainer = await prisma.user.upsert({
    where: { email: "trainer@example.com" },
    update: {
      displayName: "Trainer",
      passwordHash: hashPassword("trainer123"),
      role: "trainer",
      isActive: true
    },
    create: {
      email: "trainer@example.com",
      displayName: "Trainer",
      passwordHash: hashPassword("trainer123"),
      role: "trainer",
      isActive: true
    }
  });

  await prisma.userOrganizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: defaultOrganization.id
      }
    },
    update: { role: "admin", isActive: true },
    create: {
      userId: admin.id,
      organizationId: defaultOrganization.id,
      role: "admin",
      isActive: true
    }
  });

  await prisma.userOrganizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: trainer.id,
        organizationId: defaultOrganization.id
      }
    },
    update: { role: "trainer", isActive: true },
    create: {
      userId: trainer.id,
      organizationId: defaultOrganization.id,
      role: "trainer",
      isActive: true
    }
  });

  // Clean up existing seed data
  await prisma.participantStepProgress.deleteMany();
  await prisma.participantProgress.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.jamGame.deleteMany();
  await prisma.jam.deleteMany();
  await prisma.gameVersion.deleteMany();
  await prisma.stepHint.deleteMany();
  await prisma.gameStep.deleteMany();
  await prisma.game.deleteMany();

  // Create game template
  const game = await prisma.game.create({
    data: {
      organizationId: defaultOrganization.id,
      slug: "cyber-racer",
      title: "Cyber Racer Mission",
      shortDescription: "Build a mini racing mission with movement, obstacles, and a clear finish.",
      fullDescription: "A structured child-friendly jam with clear mission steps, hints, and trainer-visible progress.",
      themeCode: "cyber-it",
      level: "beginner",
      estimatedDurationMin: 45,
      accentStyle: "neon-grid",
      accentColor: "#8B5CF6",
      finalTitle: "Mission Complete",
      finalDescription: "Show the result to the trainer and improve the mechanics if there is still time.",
      finalRewardXp: 120,
      status: "published",
      publishedAt: new Date(),
      createdById: admin.id,
      updatedById: admin.id
    }
  });

  const stepPayloads = [
    {
      title: "Create the scene",
      description: "Add a background, a hero, and a clear start point.",
      goalText: "The player immediately sees where the mission begins.",
      successTitle: "Scene is ready",
      successText: "Now the game can start to feel alive.",
      successXp: 20
    },
    {
      title: "Add controls",
      description: "Wire movement to the keyboard so the hero can move left and right.",
      goalText: "The hero responds to the controls.",
      successTitle: "Controls work",
      successText: "The player can now influence the scene.",
      successXp: 20
    },
    {
      title: "Add obstacles",
      description: "Place blockers on the track so the player has a challenge.",
      goalText: "The track now has a real obstacle to avoid.",
      successTitle: "Obstacles are live",
      successText: "The mission is almost complete. Add the finish and polish it.",
      successXp: 30
    }
  ];

  const steps = [];
  for (let index = 0; index < stepPayloads.length; index += 1) {
    const step = await prisma.gameStep.create({
      data: {
        gameId: game.id,
        orderIndex: index + 1,
        ...stepPayloads[index]
      }
    });

    await prisma.stepHint.createMany({
      data: [
        {
          stepId: step.id,
          level: 1,
          text: `Hint L1 for step ${index + 1}: start with the simplest working version.`,
          hintType: "text"
        },
        {
          stepId: step.id,
          level: 2,
          text: `Hint L2 for step ${index + 1}: add one mechanic and verify it separately.`,
          hintType: "text"
        },
        {
          stepId: step.id,
          level: 3,
          text: `Hint L3 for step ${index + 1}: break the task into tiny actions and connect them one by one.`,
          hintType: "text"
        }
      ]
    });

    const hints = await prisma.stepHint.findMany({
      where: { stepId: step.id },
      orderBy: { level: "asc" }
    });

    steps.push({
      ...step,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
      hints: hints.map((hint) => ({
        ...hint,
        hintType: hint.hintType,
        mediaUrl: hint.mediaUrl ?? undefined,
        createdAt: hint.createdAt.toISOString(),
        updatedAt: hint.updatedAt.toISOString()
      })),
      resultVideoUrl: step.resultVideoUrl ?? undefined,
      resultImageUrl: step.resultImageUrl ?? undefined
    });
  }

  const snapshot = {
    game: {
      id: game.id,
      organizationId: game.organizationId,
      slug: game.slug,
      title: game.title,
      shortDescription: game.shortDescription,
      fullDescription: game.fullDescription,
      themeCode: game.themeCode,
      level: game.level,
      estimatedDurationMin: game.estimatedDurationMin,
      coverImageUrl: game.coverImageUrl ?? undefined,
      previewVideoUrl: game.previewVideoUrl ?? undefined,
      accentStyle: game.accentStyle,
      accentColor: game.accentColor,
      finalTitle: game.finalTitle,
      finalDescription: game.finalDescription,
      finalRewardXp: game.finalRewardXp,
      status: game.status,
      publishedAt: game.publishedAt?.toISOString(),
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
      createdBy: game.createdById,
      updatedBy: game.updatedById
    },
    steps,
    finalScreen: {
      title: game.finalTitle,
      description: game.finalDescription,
      rewardXp: game.finalRewardXp
    }
  };

  const gameVersion = await prisma.gameVersion.create({
    data: {
      gameId: game.id,
      versionNumber: 1,
      snapshotJson: snapshot as Prisma.InputJsonValue,
      createdBy: admin.id,
      isPublishedVersion: true
    }
  });

  // Create a jam (session/event)
  const jam = await prisma.jam.create({
    data: {
      organizationId: defaultOrganization.id,
      title: "Saturday Mini Jam",
      joinCode: "CYBER7",
      joinUrl: "/join/CYBER7",
      status: "active",
      startedAt: new Date(),
      createdBy: "trainer_system"
    }
  });

  await prisma.jamGame.create({
    data: {
      jamId: jam.id,
      gameVersionId: gameVersion.id,
      isDefault: true,
      orderIndex: 1
    }
  });

  const alice = await prisma.participant.create({
    data: {
      jamId: jam.id,
      displayName: "Alice",
      avatar: "robot",
      status: "active"
    }
  });

  const max = await prisma.participant.create({
    data: {
      jamId: jam.id,
      displayName: "Max",
      avatar: "pilot",
      status: "needs_help"
    }
  });

  const [step1, step2, step3] = steps;

  await prisma.participantProgress.create({
    data: {
      participantId: alice.id,
      gameVersionId: gameVersion.id,
      currentStepId: step2.id,
      completedStepsCount: 1,
      totalStepsCount: steps.length,
      xpTotal: step1.successXp,
      isCompleted: false
    }
  });

  await prisma.participantStepProgress.createMany({
    data: [
      {
        participantId: alice.id,
        gameVersionId: gameVersion.id,
        stepId: step1.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: alice.id,
        gameVersionId: gameVersion.id,
        stepId: step2.id,
        status: "active",
        startedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: alice.id,
        gameVersionId: gameVersion.id,
        stepId: step3.id,
        status: "locked"
      }
    ]
  });

  await prisma.participantProgress.create({
    data: {
      participantId: max.id,
      gameVersionId: gameVersion.id,
      currentStepId: step3.id,
      completedStepsCount: 2,
      totalStepsCount: steps.length,
      xpTotal: step1.successXp + step2.successXp,
      isCompleted: false
    }
  });

  await prisma.participantStepProgress.createMany({
    data: [
      {
        participantId: max.id,
        gameVersionId: gameVersion.id,
        stepId: step1.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: max.id,
        gameVersionId: gameVersion.id,
        stepId: step2.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 2,
        lastHintLevelOpened: 2
      },
      {
        participantId: max.id,
        gameVersionId: gameVersion.id,
        stepId: step3.id,
        status: "active",
        startedAt: new Date(),
        hintsOpenedCount: 3,
        lastHintLevelOpened: 3,
        needsHelpFlag: true,
        needsHelpAt: new Date()
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
