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
    update: {
      role: "admin",
      isActive: true
    },
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
    update: {
      role: "trainer",
      isActive: true
    },
    create: {
      userId: trainer.id,
      organizationId: defaultOrganization.id,
      role: "trainer",
      isActive: true
    }
  });

  await prisma.participantStepProgress.deleteMany();
  await prisma.participantProgress.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.sessionJam.deleteMany();
  await prisma.session.deleteMany();
  await prisma.jamVersion.deleteMany();
  await prisma.stepHint.deleteMany();
  await prisma.jamStep.deleteMany();
  await prisma.jam.deleteMany();

  const jam = await prisma.jam.create({
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
    const step = await prisma.jamStep.create({
      data: {
        jamId: jam.id,
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
    jam: {
      id: jam.id,
      organizationId: jam.organizationId,
      slug: jam.slug,
      title: jam.title,
      shortDescription: jam.shortDescription,
      fullDescription: jam.fullDescription,
      themeCode: jam.themeCode,
      level: jam.level,
      estimatedDurationMin: jam.estimatedDurationMin,
      coverImageUrl: jam.coverImageUrl ?? undefined,
      previewVideoUrl: jam.previewVideoUrl ?? undefined,
      accentStyle: jam.accentStyle,
      accentColor: jam.accentColor,
      finalTitle: jam.finalTitle,
      finalDescription: jam.finalDescription,
      finalRewardXp: jam.finalRewardXp,
      status: jam.status,
      publishedAt: jam.publishedAt?.toISOString(),
      createdAt: jam.createdAt.toISOString(),
      updatedAt: jam.updatedAt.toISOString(),
      createdBy: jam.createdById,
      updatedBy: jam.updatedById
    },
    steps,
    finalScreen: {
      title: jam.finalTitle,
      description: jam.finalDescription,
      rewardXp: jam.finalRewardXp
    }
  };

  const version = await prisma.jamVersion.create({
    data: {
      jamId: jam.id,
      versionNumber: 1,
      snapshotJson: snapshot as Prisma.InputJsonValue,
      createdBy: admin.id,
      isPublishedVersion: true
    }
  });

  const session = await prisma.session.create({
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

  await prisma.sessionJam.create({
    data: {
      sessionId: session.id,
      jamVersionId: version.id,
      isDefault: true,
      orderIndex: 1
    }
  });

  const alice = await prisma.participant.create({
    data: {
      sessionId: session.id,
      displayName: "Alice",
      avatar: "robot",
      status: "active"
    }
  });

  const max = await prisma.participant.create({
    data: {
      sessionId: session.id,
      displayName: "Max",
      avatar: "pilot",
      status: "needs_help"
    }
  });

  const [step1, step2, step3] = snapshot.steps;

  await prisma.participantProgress.create({
    data: {
      participantId: alice.id,
      jamVersionId: version.id,
      currentStepId: step2.id,
      completedStepsCount: 1,
      totalStepsCount: snapshot.steps.length,
      xpTotal: step1.successXp,
      isCompleted: false
    }
  });

  await prisma.participantStepProgress.createMany({
    data: [
      {
        participantId: alice.id,
        jamVersionId: version.id,
        stepId: step1.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: alice.id,
        jamVersionId: version.id,
        stepId: step2.id,
        status: "active",
        startedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: alice.id,
        jamVersionId: version.id,
        stepId: step3.id,
        status: "locked"
      }
    ]
  });

  await prisma.participantProgress.create({
    data: {
      participantId: max.id,
      jamVersionId: version.id,
      currentStepId: step3.id,
      completedStepsCount: 2,
      totalStepsCount: snapshot.steps.length,
      xpTotal: step1.successXp + step2.successXp,
      isCompleted: false
    }
  });

  await prisma.participantStepProgress.createMany({
    data: [
      {
        participantId: max.id,
        jamVersionId: version.id,
        stepId: step1.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 1,
        lastHintLevelOpened: 1
      },
      {
        participantId: max.id,
        jamVersionId: version.id,
        stepId: step2.id,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        hintsOpenedCount: 2,
        lastHintLevelOpened: 2
      },
      {
        participantId: max.id,
        jamVersionId: version.id,
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
