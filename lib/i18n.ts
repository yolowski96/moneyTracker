export type Locale = "en" | "bg";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "bg", label: "Български" },
];

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isLocale(x: unknown): x is Locale {
  return x === "en" || x === "bg";
}

export function isCurrency(x: unknown): x is Currency {
  return typeof x === "string" && (CURRENCIES as readonly string[]).includes(x);
}

const STRINGS = {
  en: {
    // Header / nav
    appName: "EuroTrack",
    tagline: "A minimal money tracker.",
    inbox: "Inbox",
    charts: "Charts",
    settings: "Settings",
    back: "Back",
    menu: "Menu",
    signOut: "Sign out",
    signingOut: "Signing out",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    delete: "Delete",
    edit: "Edit",
    remove: "Remove",
    archive: "Archive",
    restore: "Restore",
    rename: "Rename",

    // Cycle
    remaining: "Remaining",
    incomeDotSpent: "Income · Spent",
    base: "base",
    extra: "extra",
    resetsToday: "Resets today",
    resetsIn: "Resets in",
    pctUsed: "% used",
    txns: "txns",
    transactions: "transactions",
    setYourIncome: "set your income",
    toSeeWhatsLeft: "to see what's left",
    extraIncomeThis: "Extra income this",
    extraIncome: "Extra income",
    noTransactionsYet: "No transactions yet. Add one above, or POST to",

    // Add forms
    amountPlaceholder: "Amount",
    merchantPlaceholder: "Merchant",
    notePlaceholder: "Note (optional)",
    categoryNone: "— No category",

    // Inbox
    inboxTagline: "Uncategorized transactions. Tap a category to file each one.",
    inboxZero: "Inbox zero.",
    inboxZeroHint:
      "New transactions from your Shortcut appear here until you assign a category.",

    // Charts
    chartsTagline: "Where the money went.",
    chartsLooking: "Looking at",
    backToCurrentCycle: "Back to current cycle",
    dailySpend: "Daily spend",
    avg: "avg",
    perDay: "/day",
    perMonth: "/month",
    byCategory: "By category",
    thisCycle: "this cycle",
    nothingToBreakDown: "Nothing to break down yet.",
    topMerchants: "Top merchants",
    history: "History",
    lastNMonths: "last {n} months",
    noPriorMonths: "No prior months recorded yet.",
    trend: "Trend",
    spend: "Spend",
    income: "Income",
    avgSpendPerMonth: "Avg spend / month",
    avgIncomePerMonth: "Avg income / month",
    historyNote:
      "History and trend group by calendar month regardless of your reset day.",
    noSpendingMonth: "No spending recorded this month.",
    noSpendingCycle: "No spending yet this cycle.",

    // Settings
    settingsTagline: "Configure your cycle, income, language and API access.",
    cycleAndIncome: "Cycle · income",
    period: "Period",
    week: "Week",
    month: "Month",
    year: "Year",
    monthlyResetDay: "Monthly reset day",
    weeklyResetDay: "Weekly reset day",
    yearlyResetMonth: "Yearly reset month",
    yearlyResetDay: "Yearly reset day",
    incomePerPeriod: "Income per period",
    apiAccess: "API access",
    language: "Language",
    currency: "Currency",
    categories: "Categories",
    addCategory: "Add category",
    label: "Label",
    emoji: "Emoji",
    archived: "Archived",
    activeCategories: "Active",
    noCategories: "No categories yet.",
    saveChanges: "Save changes",
    trackBy: "Track by",
    weekHint: "Resets on the same weekday",
    monthHint: "Resets on your salary day",
    yearHint: "Resets on a specific date",
    periodIncome: "income",
    incomeDescription: "Your take-home per {p}. Used to compute what's left.",
    resetDay: "Reset day",
    salaryResetDay: "Salary / reset day",
    salaryResetHint: "Pick the day of the month you get paid. If the month is shorter (e.g. the 31st in February), it falls on the last day.",
    resetMonth: "Reset month",
    resetNote: "Your transactions aren't deleted on reset — totals just restart.",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    localeAndCurrency: "Language · currency",
    localeCurrencyDescribe: "Choose how amounts and dates are formatted.",
    appearance: "Appearance",
    apiKeyDescribe: "Authenticate iOS Shortcuts and other clients posting to",
    apiKeyHeader: "Your API key",
    noKeyYet: "No key yet",
    keyConfigured: "Key configured",
    noKeyHint: "No key yet. Generate one to authenticate your iOS Shortcut.",
    regenerate: "Regenerate",
    regenerating: "Regenerating",
    generating: "Generating",
    generateKey: "Generate key",
    regenerateWarn: "Regenerating invalidates the old key immediately.",
    hide: "Hide",
    show: "Show",
    copy: "Copy",
    copied: "Copied",
    categoriesDescribe: "Rename, add, or archive categories. Archived ones stop appearing when filing new transactions.",
    newCategory: "New category",
    emojiPlaceholder: "🍣",
    labelPlaceholder: "Category name",
    manageCategories: "Manage categories",
    noArchived: "No archived categories.",
    cycleDescribe: "How often your budget resets and what you bring in per period.",

    // Edit pages
    editTransaction: "Edit transaction",
    editIncome: "Edit extra income",
    created: "Created",
    added: "Added",
    when: "When",
    date: "Date",
    note: "Note",
    noteIncomeExample: "e.g. Q1 bonus, refund, gift",
    determinesCycle: "Determines which cycle the income counts towards.",
    confirmDeleteIncome: "Delete this income entry?",
    saving: "Saving",

    // Days
    today: "Today",
    yesterday: "Yesterday",
  },
  bg: {
    // Header / nav
    appName: "EuroTrack",
    tagline: "Минималистичен тракер за пари.",
    inbox: "Входящи",
    charts: "Графики",
    settings: "Настройки",
    back: "Назад",
    menu: "Меню",
    signOut: "Изход",
    signingOut: "Изход",
    cancel: "Отказ",
    save: "Запази",
    add: "Добави",
    delete: "Изтрий",
    edit: "Редактирай",
    remove: "Премахни",
    archive: "Архивирай",
    restore: "Възстанови",
    rename: "Преименувай",

    // Cycle
    remaining: "Остават",
    incomeDotSpent: "Доход · Разход",
    base: "база",
    extra: "екстра",
    resetsToday: "Нулиране днес",
    resetsIn: "Нулиране след",
    pctUsed: "% използвани",
    txns: "тр.",
    transactions: "транзакции",
    setYourIncome: "задай дохода си",
    toSeeWhatsLeft: ", за да видиш остатъка",
    extraIncomeThis: "Допълнителен доход този",
    extraIncome: "Допълнителен доход",
    noTransactionsYet: "Няма транзакции. Добави горе или POST към",

    // Add forms
    amountPlaceholder: "Сума",
    merchantPlaceholder: "Търговец",
    notePlaceholder: "Бележка (по избор)",
    categoryNone: "— Без категория",

    // Inbox
    inboxTagline: "Некатегоризирани транзакции. Избери категория за всяка.",
    inboxZero: "Входящите са празни.",
    inboxZeroHint:
      "Нови транзакции от Shortcut се появяват тук, докато не им зададеш категория.",

    // Charts
    chartsTagline: "Къде отидоха парите.",
    chartsLooking: "Преглед на",
    backToCurrentCycle: "Към текущия период",
    dailySpend: "Разход на ден",
    avg: "средно",
    perDay: "/ден",
    perMonth: "/месец",
    byCategory: "По категория",
    thisCycle: "този период",
    nothingToBreakDown: "Все още няма какво да разбиеш.",
    topMerchants: "Топ търговци",
    history: "История",
    lastNMonths: "последни {n} месеца",
    noPriorMonths: "Няма записани минали месеци.",
    trend: "Тенденция",
    spend: "Разход",
    income: "Доход",
    avgSpendPerMonth: "Среден разход / месец",
    avgIncomePerMonth: "Среден доход / месец",
    historyNote:
      "Историята и тенденцията групират по календарен месец независимо от деня на нулиране.",
    noSpendingMonth: "Няма разходи този месец.",
    noSpendingCycle: "Няма разходи в този период.",

    // Settings
    settingsTagline: "Настрой период, доход, език и API достъп.",
    cycleAndIncome: "Период · доход",
    period: "Период",
    week: "Седмица",
    month: "Месец",
    year: "Година",
    monthlyResetDay: "Ден за месечно нулиране",
    weeklyResetDay: "Ден за седмично нулиране",
    yearlyResetMonth: "Месец за годишно нулиране",
    yearlyResetDay: "Ден за годишно нулиране",
    incomePerPeriod: "Доход на период",
    apiAccess: "API достъп",
    language: "Език",
    currency: "Валута",
    categories: "Категории",
    addCategory: "Добави категория",
    label: "Име",
    emoji: "Емоджи",
    archived: "Архивирани",
    activeCategories: "Активни",
    noCategories: "Все още няма категории.",
    saveChanges: "Запази промените",
    trackBy: "Проследявай по",
    weekHint: "Нулира се на същия ден от седмицата",
    monthHint: "Нулира се на заплатния ден",
    yearHint: "Нулира се на конкретна дата",
    periodIncome: "доход",
    incomeDescription: "Твоят нетен доход на {p}. Използва се за изчисление на остатъка.",
    resetDay: "Ден на нулиране",
    salaryResetDay: "Ден на заплата / нулиране",
    salaryResetHint: "Избери деня от месеца, в който получаваш заплата. Ако месецът е по-кратък (напр. 31 в февруари), се премества на последния ден.",
    resetMonth: "Месец на нулиране",
    resetNote: "Транзакциите не се изтриват при нулиране — само тоталите рестартират.",
    weekly: "Седмично",
    monthly: "Месечно",
    yearly: "Годишно",
    localeAndCurrency: "Език · валута",
    localeCurrencyDescribe: "Избери как да се форматират сумите и датите.",
    appearance: "Изглед",
    apiKeyDescribe: "Автентикирай iOS Shortcut и други клиенти, които пращат към",
    apiKeyHeader: "Твоят API ключ",
    noKeyYet: "Няма ключ",
    keyConfigured: "Ключът е настроен",
    noKeyHint: "Още няма ключ. Генерирай един за iOS Shortcut.",
    regenerate: "Регенерирай",
    regenerating: "Регенериране",
    generating: "Генериране",
    generateKey: "Генерирай ключ",
    regenerateWarn: "Регенерирането обезсилва стария ключ веднага.",
    hide: "Скрий",
    show: "Покажи",
    copy: "Копирай",
    copied: "Копирано",
    categoriesDescribe: "Преименувай, добави или архивирай категории. Архивираните не се появяват при нови транзакции.",
    newCategory: "Нова категория",
    emojiPlaceholder: "🍣",
    labelPlaceholder: "Име на категория",
    manageCategories: "Управление на категории",
    noArchived: "Няма архивирани категории.",
    cycleDescribe: "Колко често се нулира бюджетът и какъв е доходът ти на период.",

    // Edit pages
    editTransaction: "Редактирай транзакция",
    editIncome: "Редактирай допълнителен доход",
    created: "Създадено",
    added: "Добавено",
    when: "Кога",
    date: "Дата",
    note: "Бележка",
    noteIncomeExample: "напр. Q1 бонус, възстановяване, подарък",
    determinesCycle: "Определя в кой период попада доходът.",
    confirmDeleteIncome: "Изтрий този запис за доход?",
    saving: "Запазване",

    // Days
    today: "Днес",
    yesterday: "Вчера",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

export function t(locale: Locale, key: StringKey, vars?: Record<string, string | number>): string {
  const table = STRINGS[locale] ?? STRINGS.en;
  let raw: string = table[key] ?? STRINGS.en[key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      raw = raw.replace(`{${k}}`, String(v));
    }
  }
  return raw;
}

// Translations for the default categories seeded at registration. Only applies
// when a category's label exactly matches one of the defaults — once a user
// renames it, the stored label wins.
const DEFAULT_CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  en: {},
  bg: {
    Food: "Храна",
    Groceries: "Хранителни стоки",
    Transport: "Транспорт",
    Home: "Дом",
    Fun: "Забавления",
    Bills: "Сметки",
  },
};

export function categoryLabel(label: string, locale: Locale): string {
  return DEFAULT_CATEGORY_LABELS[locale]?.[label] ?? label;
}
