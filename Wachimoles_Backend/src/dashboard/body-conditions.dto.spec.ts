import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { SaveBodyConditionDto } from "./body-conditions.dto";

const validateDto = (bodyRegion: unknown) =>
  validateSync(
    plainToInstance(SaveBodyConditionDto, {
      bodyRegion,
      muscleName: "Face / Facial region",
      conditionName: "Muscle pain",
      description: "Test note",
      painIntensity: 5,
      swelling: false,
      functionalLimitation: false
    }),
    { whitelist: true, forbidNonWhitelisted: true }
  );

describe("SaveBodyConditionDto bodyRegion normalization", () => {
  it("accepts canonical Spanish regions", () => {
    const regions = [
      "Cabeza y cuello",
      "Tronco anterior",
      "Tronco posterior",
      "Extremidad superior",
      "Cadera y pelvis",
      "Extremidad inferior"
    ] as const;

    for (const region of regions) {
      const dto = plainToInstance(SaveBodyConditionDto, {
        bodyRegion: region,
        muscleName: "Neck",
        conditionName: "Muscle pain",
        description: null,
        painIntensity: 4,
        swelling: false,
        functionalLimitation: false
      });
      expect(validateSync(dto)).toHaveLength(0);
      expect(dto.bodyRegion).toBe(region);
    }
  });

  it("normalizes English client region labels to canonical Spanish values", () => {
    const pairs: Array<[string, string]> = [
      ["Head and neck", "Cabeza y cuello"],
      ["Front torso", "Tronco anterior"],
      ["Anterior torso", "Tronco anterior"],
      ["Back torso", "Tronco posterior"],
      ["Posterior torso", "Tronco posterior"],
      ["Upper limb", "Extremidad superior"],
      ["Hip and pelvis", "Cadera y pelvis"],
      ["Lower limb", "Extremidad inferior"],
      ["  head and neck  ", "Cabeza y cuello"]
    ];

    for (const [input, expected] of pairs) {
      const dto = plainToInstance(SaveBodyConditionDto, {
        bodyRegion: input,
        muscleName: "Neck",
        conditionName: "Muscle pain",
        description: "",
        painIntensity: 5,
        swelling: true,
        functionalLimitation: false
      });
      expect(validateSync(dto)).toHaveLength(0);
      expect(dto.bodyRegion).toBe(expected);
    }
  });

  it("rejects unknown or non-string bodyRegion values", () => {
    expect(validateDto("Unknown zone").length).toBeGreaterThan(0);
    expect(validateDto("").length).toBeGreaterThan(0);
    expect(validateDto(123).length).toBeGreaterThan(0);
  });
});
