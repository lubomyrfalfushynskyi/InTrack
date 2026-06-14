import React, { useEffect, useState } from 'react';
import {
  Card,
  Tree,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  message,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const LocationsPage = () => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLocationTree();
  }, []);

  const fetchLocationTree = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/locations/tree', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const tree = buildTreeData(response.data);
      setTreeData(tree);
    } catch (error) {
      message.error('Помилка завантаження даних');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buildTreeData = (data) => {
    return Object.keys(data).map((region) => ({
      title: region,
      key: `region-${region}`,
      icon: <EnvironmentOutlined />,
      children: Object.keys(data[region]).map((building) => ({
        title: building,
        key: `building-${region}-${building}`,
        children: Object.keys(data[region][building]).map((room) => ({
          title: room || 'Без приміщення',
          key: `room-${region}-${building}-${room}`,
          children: data[region][building][room].map((floor) => ({
            title: floor,
            key: `floor-${region}-${building}-${room}-${floor}`,
            isLeaf: true,
          })),
        })),
      })),
    }));
  };

  const handleCreateLocation = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/locations', values, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Локацію успішно створено');
      setModalVisible(false);
      form.resetFields();
      fetchLocationTree();
    } catch (error) {
      message.error('Помилка при створенні локації');
      console.error(error);
    }
  };

  const handleUpdateLocation = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/locations/${currentLocation.location_id}`, values, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Локацію успішно оновлено');
      setModalVisible(false);
      form.resetFields();
      setCurrentLocation(null);
      fetchLocationTree();
    } catch (error) {
      message.error('Помилка при оновленні локації');
      console.error(error);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentLocation(null);
    form.resetFields();
    setModalVisible(true);
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Локації
            </Title>
            <Text type="secondary">Ієрархічна структура розташування майна</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchLocationTree}>
              Оновити
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Додати локацію
            </Button>
          </Space>
        </div>

        {/* Location Tree */}
        <Card
          title="Дерево локацій"
          loading={loading}
        >
          {treeData.length > 0 ? (
            <Tree
              showIcon
              defaultExpandAll
              treeData={treeData}
              style={{ fontSize: 14 }}
            />
          ) : (
            <Text type="secondary">Немає локацій</Text>
          )}
        </Card>
      </Space>

      {/* Create/Edit Location Modal */}
      <Modal
        title={modalMode === 'create' ? 'Створити локацію' : 'Редагувати локацію'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setCurrentLocation(null);
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={modalMode === 'create' ? handleCreateLocation : handleUpdateLocation}
        >
          <Form.Item
            label="Регіон"
            name="region"
            rules={[{ required: true, message: 'Введіть регіон' }]}
          >
            <Input placeholder="Наприклад: Київська область" />
          </Form.Item>

          <Form.Item
            label="Будівля"
            name="building"
            rules={[{ required: true, message: 'Введіть будівлю' }]}
          >
            <Input placeholder="Наприклад: Головна будівля" />
          </Form.Item>

          <Form.Item
            label="Приміщення"
            name="room"
          >
            <Input placeholder="Наприклад: Офіс 101" />
          </Form.Item>

          <Form.Item
            label="Поверх"
            name="floor"
          >
            <Input placeholder="Наприклад: 1 поверх" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Скасувати</Button>
              <Button type="primary" htmlType="submit">
                {modalMode === 'create' ? 'Створити' : 'Зберегти'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LocationsPage;
