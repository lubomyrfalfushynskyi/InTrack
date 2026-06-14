import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Typography,
  Space,
  Button,
  Tag,
  Timeline,
  Spin,
  message,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SwapOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const AssetDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssetDetails();
  }, [id]);

  const fetchAssetDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/assets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAsset(response.data.asset);
      setHistory(response.data.history || []);
      setLogs(response.data.logs || []);
    } catch (error) {
      message.error('Помилка завантаження даних');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" tip="Завантаження..." />
      </div>
    );
  }

  if (!asset) {
    return (
      <Card>
        <Text type="secondary">Майно не знайдено</Text>
      </Card>
    );
  }

  const statusColors = {
    active: 'green',
    transferred: 'blue',
    written_off: 'red',
  };

  const statusLabels = {
    active: 'Активне',
    transferred: 'Передано',
    written_off: 'Списано',
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assets')}>
              Назад
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {asset.inventory_number}
            </Title>
            <Tag color={statusColors[asset.status]}>{statusLabels[asset.status]}</Tag>
          </Space>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/assets/${id}/edit`)}>
              Редагувати
            </Button>
            {asset.status !== 'written_off' && (
              <Button icon={<SwapOutlined />} onClick={() => navigate(`/acts/new?asset_id=${id}&type=transfer`)}>
                Передати
              </Button>
            )}
            {asset.status === 'active' && (
              <Button danger icon={<DeleteOutlined />} onClick={() => navigate(`/acts/new?asset_id=${id}&type=write_off`)}>
                Списати
              </Button>
            )}
          </Space>
        </div>

        {/* Asset Details */}
        <Card title="Деталі майна">
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Інвентарний номер">{asset.inventory_number}</Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Tag color={statusColors[asset.status]}>{statusLabels[asset.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Опис" span={2}>
              {asset.description}
            </Descriptions.Item>
            <Descriptions.Item label="Власник (підрозділ)">{asset.department_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Відповідальний">{asset.owner_full_name || asset.owner_username || '-'}</Descriptions.Item>
            <Descriptions.Item label="Локація" span={2}>
              {asset.location_full || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Дата введення">
              {asset.primary_introduced_date
                ? new Date(asset.primary_introduced_date).toLocaleDateString('uk-UA')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Строк служби (років)">
              {asset.service_life_years || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Балансова вартість">
              {asset.balance_value ? `${asset.balance_value.toLocaleString('uk-UA')} грн` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Фактична вартість">
              {asset.actual_value ? `${asset.actual_value.toLocaleString('uk-UA')} грн` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Години експлуатації">
              {asset.operating_hours || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Дні експлуатації">
              {asset.operating_days || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Створено" span={2}>
              {new Date(asset.created_at).toLocaleString('uk-UA')}
            </Descriptions.Item>
            <Descriptions.Item label="Оновлено" span={2}>
              {new Date(asset.updated_at).toLocaleString('uk-UA')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* History */}
        <Card title="Історія актів">
          {history.length > 0 ? (
            <Timeline mode="left">
              {history.map((act) => {
                const colors = {
                  introduction: 'green',
                  transfer: 'blue',
                  write_off: 'red',
                };
                const labels = {
                  introduction: 'Введення в експлуатацію',
                  transfer: 'Передача',
                  write_off: 'Списання',
                };

                return (
                  <Timeline.Item
                    key={act.act_id}
                    color={colors[act.act_type]}
                    label={new Date(act.created_at).toLocaleDateString('uk-UA')}
                  >
                    <div>
                      <Text strong>{labels[act.act_type]}</Text>
                      <br />
                      <Text type="secondary">Акт №{act.act_number} від {new Date(act.act_date).toLocaleDateString('uk-UA')}</Text>
                      {act.from_department_name && (
                        <>
                          <br />
                          <Text type="secondary">Від: {act.from_department_name}</Text>
                        </>
                      )}
                      {act.to_department_name && (
                        <>
                          <br />
                          <Text type="secondary">До: {act.to_department_name}</Text>
                        </>
                      )}
                      {act.created_by_username && (
                        <>
                          <br />
                          <Text type="secondary">Створив: {act.created_by_username}</Text>
                        </>
                      )}
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          ) : (
            <Text type="secondary">Немає історії актів</Text>
          )}
        </Card>

        {/* Logs */}
        {logs.length > 0 && (
          <Card title="Останні дії">
            <Timeline mode="left">
              {logs.slice(0, 10).map((log) => (
                <Timeline.Item key={log.log_id}>
                  <div>
                    <Text strong>{log.action_type === 'create' && 'Створено'}
                      {log.action_type === 'update' && 'Оновлено'}
                      {log.action_type === 'delete' && 'Видалено'}
                      {log.action_type === 'view' && 'Переглянуто'}</Text>
                    <br />
                    <Text type="secondary">{new Date(log.timestamp).toLocaleString('uk-UA')}</Text>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default AssetDetailPage;
