import { parseFitActivity } from "./fit.parser";
import { parseGpxActivity } from "./gpx.parser";
import { parseTcxActivity } from "./tcx.parser";
import { ParsedActivityData } from "./types";

export async function parseImportedActivity(
  file: Buffer,
  originalFilename: string,
  fileType: string,
): Promise<ParsedActivityData> {
  if (fileType === "gpx") {
    return parseGpxActivity(file, originalFilename);
  }

  if (fileType === "tcx") {
    return parseTcxActivity(file, originalFilename);
  }

  if (fileType === "fit") {
    return parseFitActivity(file, originalFilename);
  }

  throw new Error(`Unsupported import file type: ${fileType}`);
}
