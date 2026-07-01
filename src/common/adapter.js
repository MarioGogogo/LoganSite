import {getLogTypeConfig} from "./logtype-helper";

export const convertBriefsToMinimapBriefs = (briefs, type) => {
  let ret = [];
  for (let brief of briefs) {
    const logType = getLogTypeConfig(brief.logType);

    if (type === "native") {
      ret.push({
        id: brief.id,
        time: brief.logTime,
        logType: {
          type: logType.logType,
          logTypeName: logType.logTypeName,
          displayColor: logType.displayColor
        }
      });
    } else {
      ret.push({
        id: brief.detailId,
        time: brief.logTime,
        logType: {
          type: logType.logType,
          logTypeName: logType.logTypeName,
          displayColor: logType.displayColor
        }
      })
    }


  }
  return ret;
};

export const convertBriefsToLoglistInfiniteScrollBriefs = (briefs, type) => {
  if (type === "native") {
    return briefs;
  } else {
    return briefs.map(item => ({
      id: item.detailId,
      logTime: item.logTime,
      logType: item.logType
    }))
  }
};

