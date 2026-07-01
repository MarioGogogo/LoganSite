import React, { Component } from "react";
import { Card, Button } from "antd";
import moment from "moment";
import ReactJson from "react-json-view";
import "./style.scss";
import {getLogTypeConfig} from "../../../../../common/logtype-helper";

const titleByKey = {
  "id": "日志编号",
  "taskId": "任务编号",
  "logType": "日志类型",
  "logTime": "日志记录时间"
};

/**
 * 尝试从日志 content 中解析出 JSON 部分。
 * 支持两种形态：
 *  1) 整个 content 就是 JSON 字符串，如 '{"a":1,"b":[1,2]}'
 *  2) content 是「前缀文本 + JSON」混合，如 '订单 下单失败 {"orderId":123}'
 *     （RN 全局方法 OutputLog/ReportImmediate 拼出的就是这个样子）
 *
 * 返回：
 *  - { prefix, json } 当含可解析 JSON 时；prefix 为 JSON 之前的文本（可能为空），json 为解析后的对象
 *  - null 当不是 JSON（调用方按纯文本展示）
 */
function tryExtractJson(content) {
  if (typeof content !== "string" || content.length === 0) return null;
  const str = content.trim();
  // 形态1：整体是对象/数组
  if ((str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"))) {
    try {
      return { prefix: "", json: JSON.parse(str) };
    } catch (e) { /* fall through */ }
  }
  // 形态2：前缀文本 + 末尾的 {...} 或 [...]
  const firstBrace = str.search(/[{[]/);
  if (firstBrace > 0) {
    const candidate = str.slice(firstBrace).trim();
    if ((candidate.startsWith("{") && candidate.endsWith("}")) ||
        (candidate.startsWith("[") && candidate.endsWith("]"))) {
      try {
        return { prefix: str.slice(0, firstBrace).trim(), json: JSON.parse(candidate) };
      } catch (e) { /* not json */ }
    }
  }
  return null;
}

/** 渲染日志内容：JSON 美化展示，否则纯文本 */
function renderLogContent(content) {
  const extracted = tryExtractJson(content);
  if (extracted) {
    return (
      <div className="log-content-json">
        {extracted.prefix && <div className="log-content-prefix">{extracted.prefix}</div>}
        <ReactJson
          src={extracted.json}
          name={false}
          collapsed={false}
          enableClipboard={true}
          displayDataTypes={false}
          displayObjectSize={false}
          iconStyle="triangle"
          theme="rjv-default"
        />
      </div>
    );
  }
  return <span>{content}</span>;
}

class LogDetailCard extends Component {

  render() {
    const { focusLogId, logDetail } = this.props;
    if (focusLogId === -1) {
      return null;
    } else {
      const { cardTitle, closeButton, metaDatas } = this.conposeSnippetComponents();
      return (
        <Card
            className="detail-information-container"
            title={cardTitle}
            extra={closeButton}>
          <div className="metadata">
            { metaDatas }
          </div>
          {logDetail && <div className="log-content">
            日志信息:<br />
            { renderLogContent(logDetail["content"]) }
          </div>}
        </Card>
      );
    }
  }

  handleCloseButtonClicked = () => {
    this.props.updateFocusLogId(-1);
  };

  conposeSnippetComponents = () => {
    const { logDetail } = this.props;
    if (logDetail !== null) {
      const cardTitle = (
        <header>
          <h1>日志条目详情</h1>
        </header>
      );

      const closeButton = (
        <Button icon="close" shape="circle" size="small" onClick={this.handleCloseButtonClicked}/>
      );

      const metaDatas = Object.keys(logDetail).map(key => {
        if (!Object.keys(titleByKey).includes(key)) {
          return null;
        }
        let value = "";
        if (key === "logType") {
          value = getLogTypeConfig(logDetail[key]).logTypeName;
        } else if (key === "logTime") {
          value = moment(logDetail[key]).format('YYYY-MM-DD HH:mm:ss.SSS');
        } else {
          value = logDetail[key];
        }
        return (
          <div className="metadata-item" key={titleByKey[key]}>
            { titleByKey[key] } : { value }
          </div>
        )
      });

      return {
        cardTitle,
        closeButton,
        metaDatas
      }
    } else {
      return {
        cardTitle: null,
        closeButton: null,
        metaDatas: null
      }
    }

  };
}

export default LogDetailCard;
