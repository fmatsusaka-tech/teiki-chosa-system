export type SurveyMasterItem = {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  isActive: boolean;
};

export const orchardMasters: readonly SurveyMasterItem[] = [
  { id: "arinaka", canonicalName: "有中", aliases: [], isActive: true },
  { id: "yoshikawa", canonicalName: "吉川", aliases: [], isActive: true },
  { id: "naru-1", canonicalName: "なる1", aliases: ["なる１"], isActive: true },
  { id: "naru-2", canonicalName: "なる2", aliases: ["なる２"], isActive: true },
  { id: "kaminakajima", canonicalName: "上中島", aliases: [], isActive: true },
  { id: "shimo-machi", canonicalName: "下町", aliases: [], isActive: true },
  { id: "tokuda", canonicalName: "徳田", aliases: ["トクダ", "トクタ"], isActive: true },
];

export const varietyMasters: readonly SurveyMasterItem[] = [
  { id: "yura-wase", canonicalName: "ゆら早生", aliases: [], isActive: true },
  {
    id: "wase",
    canonicalName: "早生",
    aliases: ["早生（宮川・興津など）"],
    isActive: true,
  },
];

export const orchardVarietyDefaults: Readonly<Record<string, string>> = {
  有中: "ゆら早生",
  吉川: "ゆら早生",
  なる1: "ゆら早生",
  なる2: "早生",
  上中島: "早生",
  下町: "早生",
  徳田: "早生",
};

export function getActiveMasterNames(items: readonly SurveyMasterItem[]): string[] {
  return items.filter((item) => item.isActive).map((item) => item.canonicalName);
}
