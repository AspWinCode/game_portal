import { Injectable, OnModuleInit } from "@nestjs/common";
import { AppStore } from "../../infrastructure/app.store.js";

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly store: AppStore) {}

  onModuleInit() {
    if (process.env.DATABASE_URL) {
      return;
    }

    if (this.store.games.size > 0) {
      return;
    }

    const jam = this.store.createGame({
      organizationId: "org_demo",
      isTemplate: false,
      slug: "cyber-racer",
      title: "Cyber Racer Mission",
      shortDescription: "Собери мини-игру про ускорение и реакцию.",
      fullDescription: "Пошаговый детский джем с ясной структурой и контролируемым уровнем сложности.",
      themeCode: "cyber-it",
      level: "beginner",
      estimatedDurationMin: 45,
      accentStyle: "neon-grid",
      accentColor: "#8B5CF6",
      finalTitle: "Миссия завершена",
      finalDescription: "Покажи тренеру результат и улучши механику, если останется время.",
      finalRewardXp: 120,
      createdBy: "seed_admin",
      updatedBy: "seed_admin"
    });

    const steps = [
      {
        title: "Создай сцену",
        description: "Собери фон, героя и стартовую точку.",
        goalText: "Игрок видит, где начинается миссия.",
        successTitle: "Стартовая сцена готова",
        successText: "Можно оживлять игру дальше.",
        successXp: 20
      },
      {
        title: "Подключи управление",
        description: "Настрой движение персонажа по кнопкам.",
        goalText: "Герой двигается влево и вправо.",
        successTitle: "Управление работает",
        successText: "Теперь игрок реально влияет на сцену.",
        successXp: 20
      },
      {
        title: "Добавь препятствия",
        description: "Сделай объекты, с которыми нельзя сталкиваться.",
        goalText: "На трассе появился вызов.",
        successTitle: "Препятствия на месте",
        successText: "Осталось добавить финиш и победу.",
        successXp: 30
      }
    ];

    steps.forEach((stepData, index) => {
      const step = this.store.createStep(jam.id, stepData);
      this.store.createHint(step.id, {
        level: 1,
        text: `Подсказка L1 для шага ${index + 1}: начни с самой простой версии решения.`,
        hintType: "text"
      });
      this.store.createHint(step.id, {
        level: 2,
        text: `Подсказка L2 для шага ${index + 1}: добавь одну рабочую механику и проверь её отдельно.`,
        hintType: "text"
      });
      this.store.createHint(step.id, {
        level: 3,
        text: `Подсказка L3 для шага ${index + 1}: разбей задачу на маленькие действия и собери их по очереди.`,
        hintType: "text"
      });
    });

    const version = this.store.createVersion(jam.id, "seed_admin");
    const jamEvent = this.store.createJam("Субботний мини-джем", "seed_trainer");
    this.store.updateJamStatus(jamEvent.id, "active");
    this.store.attachGameToJam(jamEvent.id, version.id, true);

    const participant = this.store.joinJam(jamEvent.joinCode, "Алиса", "robot");
    this.store.createParticipantProgress(participant.id, version.id);
    this.store.completeStep(participant.id, version.snapshotJson.steps[0].id);

    const secondParticipant = this.store.joinJam(jamEvent.joinCode, "Макс", "pilot");
    this.store.createParticipantProgress(secondParticipant.id, version.id);
    this.store.completeStep(secondParticipant.id, version.snapshotJson.steps[0].id);
    this.store.completeStep(secondParticipant.id, version.snapshotJson.steps[1].id);
    this.store.requestHelp(secondParticipant.id, version.snapshotJson.steps[2].id);
  }
}
