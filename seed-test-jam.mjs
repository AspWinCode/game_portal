/**
 * Создаёт тестовый опубликованный джем и назначает его в сессию CYBER7
 * Запуск: node seed-test-jam.mjs
 */

const BASE = "http://localhost:4000/api";
let cookieJar = "";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar ? { Cookie: cookieJar } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  // Собираем куки из ответа
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    const pair = c.split(";")[0];
    const [name] = pair.split("=");
    // Убираем старое значение этой куки и добавляем новую
    const parts = cookieJar.split("; ").filter((p) => !p.startsWith(`${name}=`));
    parts.push(pair);
    cookieJar = parts.join("; ");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const post  = (path, body) => req("POST",  path, body);
const patch = (path, body) => req("PATCH", path, body);
const get   = (path)       => req("GET",   path);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // ── 0. Логин ──────────────────────────────────────────────────────────────
  console.log("🔐 Логин...");
  await post("/auth/login", { email: "admin@example.com", password: "admin123" });
  console.log("✅ Авторизован\n");

  // ── 1. Создаём джем ───────────────────────────────────────────────────────
  console.log("📦 Создаём джем...");
  const jamRes = await post("/admin/jams", {
    slug: `gdevelop-test-${Date.now()}`,
    title: "Первая игра на GDevelop",
    shortDescription: "Создай простую игру с движущимся персонажем за 30 минут.",
    fullDescription: "Знакомство с GDevelop: сцены, объекты, события и физика. Ученик пройдёт путь от пустого проекта до работающей мини-игры.",
    themeCode: "game-dev",
    level: "beginner",
    estimatedDurationMin: 30,
    accentStyle: "neon-grid",
    accentColor: "#6366F1",
    finalTitle: "Игра готова! 🎮",
    finalDescription: "Ты создал свою первую игру на GDevelop. Покажи её тренеру!",
    finalRewardXp: 150,
    isTemplate: false
  });
  const jam = jamRes.data ?? jamRes;
  console.log(`✅ Джем: ${jam.id}\n`);

  // ── 2. Шаги ───────────────────────────────────────────────────────────────
  const stepsData = [
    {
      title: "Создай новый проект",
      description: "Открой GDevelop и создай новый пустой проект. Назови его «Моя первая игра».",
      goalText: "Создать новый проект в GDevelop с именем «Моя первая игра»",
      successTitle: "Проект создан!",
      successText: "Отлично! Ты сделал первый шаг. Теперь у тебя есть пустой проект.",
      successXp: 30
    },
    {
      title: "Добавь персонажа",
      description: "Создай новую сцену и добавь объект-спрайт. Загрузи изображение или используй встроенные ресурсы GDevelop.",
      goalText: "На сцене должен появиться объект-персонаж (спрайт)",
      successTitle: "Персонаж добавлен!",
      successText: "Теперь в твоей игре есть персонаж. Самое время научить его двигаться!",
      successXp: 40
    },
    {
      title: "Сделай персонажа управляемым",
      description: "Добавь события: при нажатии стрелок на клавиатуре персонаж двигается влево/вправо.",
      goalText: "Персонаж двигается влево и вправо по нажатию стрелок",
      successTitle: "Управление работает!",
      successText: "Персонаж двигается — это уже настоящая игра! Осталось добавить прыжок.",
      successXp: 50
    },
    {
      title: "Добавь прыжок",
      description: "Добавь поведение «Платформер» к персонажу и создай платформу. Проверь прыжок по стрелке вверх.",
      goalText: "Персонаж прыгает и приземляется на платформу",
      successTitle: "Прыжок есть! 🎉",
      successText: "Поздравляем! Нажми «Предпросмотр» и поиграй в свою игру!",
      successXp: 30
    }
  ];

  const stepIds = [];
  for (const [i, stepData] of stepsData.entries()) {
    await sleep(600);
    process.stdout.write(`📝 Шаг ${i + 1}: ${stepData.title}... `);
    const stepRes = await post(`/admin/jams/${jam.id}/steps`, stepData);
    const step = stepRes.data ?? stepRes;
    stepIds.push(step.id);
    console.log(`✅`);
  }
  console.log();

  // ── 3. Подсказки ──────────────────────────────────────────────────────────
  const hintsData = [
    [
      { level: 1, hintType: "text", text: "На стартовом экране нажми «Создать новый проект» → «Пустой проект»." },
      { level: 2, hintType: "text", text: "Имя проекта вводится при создании. Если пропустил — зайди в Файл → Настройки проекта." },
      { level: 3, hintType: "text", text: "Сохрани проект: Файл → Сохранить (Ctrl+S). Выбери папку на компьютере." }
    ],
    [
      { level: 1, hintType: "text", text: "В редакторе сцены справа есть панель «Объекты». Нажми «+» → «Добавить объект» → «Спрайт»." },
      { level: 2, hintType: "text", text: "Двойной клик на объект → «Редактировать» → нажми «+» в анимациях → загрузи файл или выбери из библиотеки ресурсов." },
      { level: 3, hintType: "text", text: "Перетащи объект из панели на сцену, чтобы он появился в игре." }
    ],
    [
      { level: 1, hintType: "text", text: "Переключись на вкладку «События» (иконка молнии вверху). Нажми «Добавить событие» → «Стандартное событие»." },
      { level: 2, hintType: "text", text: "В условии: «Клавиатура» → «Клавиша зажата» → стрелка влево. В действии: персонаж → силы → -200 по X." },
      { level: 3, hintType: "text", text: "Добавь второе событие для стрелки вправо (+200 по X). Нажми Ctrl+Enter чтобы проверить." }
    ],
    [
      { level: 1, hintType: "text", text: "Двойной клик на персонажа → «Поведения» → «Добавить поведение» → «Платформер»." },
      { level: 2, hintType: "text", text: "Добавь объект-платформу. В его поведениях выбери «Препятствие платформера»." },
      { level: 3, hintType: "text", text: "С поведением Платформер прыжок встроен — стрелка вверх или пробел. Просто запусти предпросмотр!" }
    ]
  ];

  for (const [i, hints] of hintsData.entries()) {
    const stepId = stepIds[i];
    for (const hint of hints) {
      await sleep(400);
      await post(`/admin/steps/${stepId}/hints`, hint);
    }
    console.log(`💡 Подсказки для шага ${i + 1} добавлены`);
  }
  console.log();

  // ── 4. Публикуем ─────────────────────────────────────────────────────────
  console.log("🚀 Публикуем джем...");
  const versionRes = await post(`/admin/jams/${jam.id}/publish`, {});
  const version = versionRes.data ?? versionRes;
  console.log(`✅ Версия: ${version.id}\n`);

  // ── 5. Узнаём участников сессии CYBER7 из БД ─────────────────────────────
  // Назначаем джем сессии через trainer API
  console.log("🔗 Ищем сессию CYBER7...");
  let sessionId = null;
  try {
    const sessionsRes = await get("/trainer/sessions");
    const sessions = sessionsRes.data ?? sessionsRes;
    const cyber7 = Array.isArray(sessions)
      ? sessions.find((s) => s.joinCode === "CYBER7")
      : null;
    if (cyber7) {
      sessionId = cyber7.id;
      console.log(`   Найдена: ${sessionId}`);
      await post(`/trainer/sessions/${sessionId}/jam`, { jamVersionId: version.id });
      console.log("✅ Джем назначен сессии CYBER7\n");
    } else {
      console.log("   Сессия CYBER7 не найдена через API, пропускаем\n");
    }
  } catch (e) {
    console.log(`   ⚠️  Не удалось назначить через API: ${e.message}\n`);
  }

  // ── 6. Итог ───────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Джем:       ${jam.title}`);
  console.log(`Jam ID:     ${jam.id}`);
  console.log(`Version ID: ${version.id}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("1️⃣  Открой джем и убедись что опубликован:");
  console.log(`   http://localhost:3000/admin/jams/${jam.id}\n`);

  console.log("2️⃣  Войди как участник через join-ссылку:");
  console.log("   http://localhost:3000/join/CYBER7\n");

  console.log("3️⃣  Или прямо на страницу выбора джема:");
  console.log("   Alice: http://localhost:3000/participant/cmnemnk36000vcqvczerlyyjm/jams");
  console.log("   Max:   http://localhost:3000/participant/cmnemnk38000xcqvcogpzk1zi/jams\n");

  console.log("4️⃣  После выбора джема — страница миссии с GDevelop:");
  console.log("   Alice: http://localhost:3000/mission/cmnemnk36000vcqvczerlyyjm");
  console.log("   Max:   http://localhost:3000/mission/cmnemnk38000xcqvcogpzk1zi");
}

main().catch((e) => {
  console.error("\n❌ Ошибка:", e.message);
  process.exit(1);
});
