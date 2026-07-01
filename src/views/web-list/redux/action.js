import {
  WEB_UPDATE_FILTER_CONDITIONS,
  WEB_UPDATE_TASKS,
  WEB_CHANGE_LOADING
} from "./reducer";
import {fetchWebTaskApi, fetchWebListInitData, clearAllWebLogsApi, clearWebLogsByDeviceApi} from "../../../common/api";


export function fetchInitData() {
  return (dispatch) => {
    return fetchWebListInitData()
      .then(data => {
        dispatch({
          type: WEB_UPDATE_TASKS,
          tasks: data
        })
      })
  }
}

export function updateFilterConditions(newFilterConditions) {
  return (dispatch) => {
    dispatch({
      type: WEB_UPDATE_FILTER_CONDITIONS,
      filterConditions: newFilterConditions
    });
  };
}

export function changeLoading(loading) {
  return (dispatch) => {
    dispatch({
      type: WEB_CHANGE_LOADING,
      loading: loading
    });
  };
}

export function fetchTasks({deviceId, beginTime, endTime}) {
  return (dispatch) => {
    return fetchWebTaskApi(deviceId, beginTime, endTime)
      .then(data => {
        dispatch({
          type: WEB_UPDATE_TASKS,
          tasks: data
        });
      });
  };
}

// 清空全部日志：成功后清空列表（返回删除 task 数，供 UI 提示）
export function clearAllLogs() {
  return (dispatch) => {
    return clearAllWebLogsApi().then((data) => {
      dispatch({ type: WEB_UPDATE_TASKS, tasks: [] });
      return data;
    });
  };
}

// 清空指定 deviceId 的日志
export function clearLogsByDevice(deviceId) {
  return (dispatch) => {
    return clearWebLogsByDeviceApi(deviceId).then((data) => {
      // 本地列表里移除该设备的任务，避免再请求一次
      dispatch({
        type: WEB_UPDATE_TASKS,
        tasks: [] // 简单起见直接清空，用户下次搜索会重新拉
      });
      return data;
    });
  };
}
