import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Table, Tag, DatePicker, Spin } from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalAssets: 0,
    activeAssets: 0,
    transferredAssets: 0,
    writtenOffAssets: 0,
    totalActs: 0,
    totalUsers: 0,
  });
  const [recentActs, setRecentActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch stats
      const [assetsRes, actsRes, usersRes] = await Promise.all([
        axios.get('/api/assets?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/acts?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/users?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats({
        totalAssets: assetsRes.data.pagination.total,
        activeAssets: 0, // Would need backend endpoint for this
        transferredAssets: 0,
        writtenOffAssets: 0,
        totalActs: actsRes.data.pagination.total,
        totalUsers: usersRes.data.pagination.total,
      });

      setRecentActs(actsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const actsColumns = [
    {
      title: 'Номер',
      dataIndex: 'act_number',
      key: 'act_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/acts?type=${record.act_type}`)}>{text}</a>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'act_type',
      key: 'act_type',
      render: (type) => {
        const colors = {
          introduction: 'green',
          transfer: 'blue',
          write_off: 'red',
        };
        const labels = {
          introduction: 'Введення',
          transfer: 'Передача',
          write_off: 'Списання',
        };
        return <Tag color={colors[type]}>{labels[type]}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'act_date',
      key: 'act_date',
      render: (date) => new Date(date).toLocaleDateString('uk-UA'),
    },
    {
      title: 'Майно',
      dataIndex: 'asset_description',
      key: 'asset_description',
      ellipsis: true,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Завантаження..." />
      </div>
    );
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Дашборд</Title>
          <Text type="secondary">Огляд системи обліку майна</Text>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Всього майна"
                value={stats.totalAssets}
                prefix={<InboxOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Активних"
                value={stats.activeAssets}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Всього актів"
                value={stats.totalActs}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Користувачів"
                value={stats.totalUsers}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Recent Acts */}
        <Card
          title="Останні акти"
          extra={<a onClick={() => navigate('/acts')}>Переглянути всі</a>}
        >
          <Table
            columns={actsColumns}
            dataSource={recentActs}
            rowKey="act_id"
            pagination={false}
            size="small"
          />
        </Card>
      </Space>
    </div>
  );
};

export default DashboardPage;
