import React, { Component } from "react";
import {connect} from "react-redux";
import PropTypes from "prop-types";
import { Input, Select, DatePicker, Icon, Layout, Button, message, Modal } from "antd";
import "antd/dist/antd.css";
import "./style.scss";
import moment from "moment";

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Header } = Layout;

class HeaderBar extends Component {

  static propTypes = {
    filterConditions: PropTypes.object,
    updateFilterConditions: PropTypes.func,
    fetchTasks: PropTypes.func,
    type: PropTypes.string
  };

  static defaultProps = {
    filterConditions: {
      deviceId: "",
      platform: 0,
      beginTime: moment().startOf("week"),
      endTime: moment().startOf("day")
    },
    updateFilterConditions: null,
    fetchTasks: null
  };

  render() {
    const { filterConditions, type } = this.props;
    return (
      <Header className="header">
        <div className="tasklist-filterbar-container">
          <Input.Group compact className="filterbar-group">
            {
              type === "native" &&
              <Select
                data-test="platform-selector"
                value={filterConditions.platform}
                onChange={this.handlePlatformChange}
                style={{ minWidth: "100px" }}
              >
                <Option value={0}>全部平台</Option>
                <Option value={1}>Android</Option>
                <Option value={2}>iOS</Option>
              </Select>
            }
            <RangePicker
              data-test="range-picker"
              allowClear={false}
              format="YYYY-MM-DD"
              placeholder={["起始时间", "结束时间"]}
              onChange={this.handleTimeRangeChange}
              value={[moment(filterConditions.beginTime), moment(filterConditions.endTime)]}
              style={{ minWidth: "240px" }}
            />
            <Input
              data-test="deviceId-input"
              className="filter-input"
              placeholder="设备编号"
              value={filterConditions.deviceId}
              onChange={this.handleDeviceIdChange}
              suffix={
                filterConditions.deviceId ? (
                  <Icon
                    data-test="clean-deviceId-icon"
                    className="empty-search"
                    key="empty-search"
                    type="close-circle"
                    onClick={this.handleCleanDeviceId}
                  />
                ) : (
                  <span />
                )
              }
            />
          </Input.Group>
          <Button data-test="search-button" className="search-button" icon="search" type="primary" onClick={this.handleSearch}>
            搜索
          </Button>
          {type === "web" && (
            <>
              <Button
                data-test="clear-device-button"
                className="clear-device-button"
                icon="delete"
                disabled={!filterConditions.deviceId}
                onClick={this.handleClearDeviceLogs}
              >
                清空该设备
              </Button>
              <Button
                data-test="clear-all-button"
                className="clear-all-button"
                icon="delete"
                type="danger"
                onClick={this.handleClearAllLogs}
              >
                清空全部日志
              </Button>
            </>
          )}
        </div>
      </Header>
    );
  }

  // event handlers
  handleSearch = () => {
    const { filterConditions, fetchTasks, type } = this.props;
    if (filterConditions.deviceId === "") {
      message.error("必须填写设备编号才能进行查询！");
      return;
    }
    if (type === "native") {
      fetchTasks({
        deviceId: filterConditions.deviceId,
        platform: filterConditions.platform,
        beginTime: moment(filterConditions.beginTime).valueOf(),
        endTime: moment(filterConditions.endTime).valueOf()
      });
    } else {
      fetchTasks({
        deviceId: filterConditions.deviceId,
        beginTime: moment(filterConditions.beginTime).valueOf(),
        endTime: moment(filterConditions.endTime).valueOf()
      })
    }

  };

  // 清空全部日志（仅 web）：高危，二次确认
  handleClearAllLogs = () => {
    const { clearAllLogs } = this.props;
    Modal.confirm({
      title: "清空全部日志",
      content: "将删除所有设备的全部日志（任务 + 明细），此操作不可恢复，确定继续？",
      okText: "确认清空",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        return clearAllLogs().then((data) => {
          message.success(`已清空全部日志（删除 ${data && data.tasks != null ? data.tasks : 0} 条任务）`);
        });
      }
    });
  };

  // 清空当前 deviceId 的日志（仅 web）：高危，二次确认
  handleClearDeviceLogs = () => {
    const { filterConditions, clearLogsByDevice } = this.props;
    if (!filterConditions.deviceId) {
      message.warn("请先填写设备编号");
      return;
    }
    Modal.confirm({
      title: `清空设备 ${filterConditions.deviceId} 的日志`,
      content: `将删除该设备的全部日志，此操作不可恢复，确定继续？`,
      okText: "确认清空",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        return clearLogsByDevice(filterConditions.deviceId).then((data) => {
          message.success(`已清空该设备日志（删除 ${data && data.tasks != null ? data.tasks : 0} 条任务）`);
        });
      }
    });
  };

  handleDeviceIdChange = e => {
    const { filterConditions, updateFilterConditions } = this.props;

    updateFilterConditions({
      ...filterConditions,
      deviceId: e.target.value
    });
  };

  handleCleanDeviceId = () => {
    const { filterConditions, updateFilterConditions } = this.props;

    updateFilterConditions({
      ...filterConditions,
      deviceId: ""
    });
  };

  handlePlatformChange = value => {
    const { filterConditions, updateFilterConditions } = this.props;

    updateFilterConditions({
      ...filterConditions,
      platform: value
    });
  };

  handleTimeRangeChange = value => {
    const { filterConditions, updateFilterConditions } = this.props;
    const [beginMoment, endMoment] = value;

    if (endMoment.diff(beginMoment) >= 7 * 86400000) {
      message.warn("请保证选择的时间范围不超过7天");
      return;
    }
    updateFilterConditions({
      ...filterConditions,
      beginTime: beginMoment.valueOf(),
      endTime: endMoment.valueOf()
    });

  };
}

function mapStateToProps(state) {
  return {
    pathname: state.router.location.pathname,
    search: state.router.location.search,
    hash: state.router.location.hash,
  }
}

export default connect(mapStateToProps)(HeaderBar);
