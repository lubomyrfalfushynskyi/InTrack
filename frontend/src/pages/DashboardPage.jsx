import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Checkbox, Dropdown, Button, Spin } from 'antd';
import { InboxOutlined, CheckCircleOutlined, WarningOutlined, StopOutlined, FileTextOutlined, TeamOutlined, SettingOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { assetsAPI, actsAPI, usersAPI } from '../services/api';
import InfoButton from '../components/InfoButton';
import SmartTable from '../components/SmartTable';

const { Title, Text } = Typography;

const ALL_WIDGETS = [
  { key: 'total', label: 'Всього майна' },
  { key: 'active', label: 'Придатне' },
  { key: 'expired', label: 'Прострочене' },
  { key: 'transferred', label: 'Передане' },
  { key: 'written_off', label: 'Списане' },
  { key: 'acts', label: 'Актів' },
  { key: 'users', label: 'Користувачів' },
  { key: 'expiredList', label: 'Список: кому продовжити' },
];

const DashboardPage = () => {
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, transferred: 0, written_off: 0, acts: 0, users: 0 });
  const [expired, setExpired] = useState([]);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('dash_widgets') || 'null'); if (s) return s; } catch (e) {}
    return ALL_WIDGETS.map((w) => w.key);
  });
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [all, active, expiredR, transferredR, off, actsR, usersR] = await Promise.all([
          assetsAPI.getAll({ limit: 1 }),
          assetsAPI.getAll({ limit: 1, status: 'active' }),
          assetsAPI.getAll({ limit: 50, status: 'expired' }),
          assetsAPI.getAll({ limit: 1, status: 'transferred' }),
          assetsAPI.getAll({ limit: 1, status: 'written_off' }),
          actsAPI.getAll({ limit: 1 }),
          usersAPI.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        ]);
        setStats({
          total: all.data.pagination.total, active: active.data.pagination.total, expired: expiredR.data.pagination.total,
          transferred: transferredR.data.pagination.total, written_off: off.data.pagination.total,
          acts: actsR.data.pagination.total, users: usersR.data.pagination.total,
        });
        setExpired(expiredR.data.data);
      } catch (e) { /* scoped */ } finally { setLoading(false); }
    })();
  }, []);

  const toggleWidget = (k) => {
    setWidgets((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      localStorage.setItem('dash_widgets', JSON.stringify(next));
      return next;
    });
  };

  const cards = [
    { key: 'total', title: 'Всього майна', value: stats.total, icon: <InboxOutlined />, color: '#1890ff' },
    { key: 'active', title: 'Придатне', value: stats.active, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { key: 'expired', title: 'Прострочене', value: stats.expired, icon: <WarningOutlined />, color: '#cf1322' },
    { key: 'transferred', title: 'Передане', value: stats.transferred, icon: <ArrowRightOutlined />, color: '#fa8c16' },
    { key: 'written_off', title: 'Списане', value: stats.written_off, icon: <StopOutlined />, color: '#8c8c8c' },
    { key: 'acts', title: 'Актів', value: stats.acts, icon: <FileTextOutlined />, color: '#13c2c2' },
    { key: 'users', title: 'Користувачів', value: stats.users, icon: <TeamOutlined />, color: '#722ed1' },
  ];

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Дашборд</Title><Text type="secondary">Огляд стану майна</Text></div>
          <Space>
            <Dropdown trigger={['click']} menu={{ items: ALL_WIDGETS.map((w) => ({ key: w.key, label: <Checkbox checked={widgets.includes(w.key)} onChange={() => toggleWidget(w.key)}>{w.label}</Checkbox> })) }}>
              <Button icon={<SettingOutlined />}>Віджети</Button>
            </Dropdown>
            <InfoButton title="Дашборд" items={[
              { title: 'Налаштування', text: 'Натисніть «Віджети» й позначте, які картки/списки показувати. Вибір зберігається для вас.' },
              { title: 'Кому продовжити', text: 'Список простроченого майна (залишковий строк < 0). Відкрийте картку й внесіть акт продовження.' },
            ]} />
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {cards.filter((c) => widgets.includes(c.key)).map((c) => (
            <Col key={c.key} xs={12} md={6}><Card><Statistic title={c.title} value={c.value} prefix={c.icon} valueStyle={{ color: c.color }} /></Card></Col>
          ))}
        </Row>

        {widgets.includes('expiredList') && (
          <Card title="Пора продовжити експлуатацію (прострочені)" extra={<a onClick={() => navigate('/assets')}>Усі</a>}>
            <SmartTable
              size="small"
              rowKey="asset_id"
              pagination={false}
              dataSource={expired.slice(0, 10)}
              columns={[
                { title: 'Інвентарний номер', dataIndex: 'inventory_number', key: 'inventory_number', width: 150, render: (t, r) => <a onClick={() => navigate(`/assets/${r.asset_id}`)}>{t}</a> },
                { title: 'Найменування', dataIndex: 'name', key: 'name', width: 250 },
                { title: 'Підрозділ', dataIndex: 'department_name', key: 'department_name', width: 200 },
                { title: 'Залишковий строк', dataIndex: 'remaining_life_years', key: 'remaining_life_years', width: 150, render: (v) => <span style={{ color: '#cf1322', fontWeight: 600 }}>{v} р.</span> },
              ]}
              locale={{ emptyText: 'Прострочених немає' }}
              onRow={(r) => ({ onClick: () => navigate(`/assets/${r.asset_id}`), style: { cursor: 'pointer' } })}
            />
          </Card>
        )}
      </Space>
    </div>
  );
};

export default DashboardPage;
