import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Card,
  Space,
  Button,
  Tag,
  Select,
  Typography,
  DatePicker,
  message,
  Modal,
  Form,
  Input,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const ActsPage = () => {
  const navigate = useNavigate();
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  useEffect(() => {
    fetchActs();
  }, [pagination.current, pagination.pageSize]);

  const fetchActs = async (params = {}) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/acts', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          ...params,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setActs(response.data.data);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination.total,
      }));
    } catch (error) {
      message.error('Помилка завантаження даних');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAct = async (values) => {
    try {
      const token = localStorage.getItem('token');
      let endpoint;

      switch (modalType) {
        case 'introduction':
          endpoint = '/api/acts/introduction';
          break;
        case 'transfer':
          endpoint = '/api/acts/transfer';
          break;
        case 'write_off':
          endpoint = '/api/acts/write-off';
          break;
        default:
          return;
      }

      const payload = {
        ...values,
        act_date: values.act_date.format('YYYY-MM-DD'),
      };

      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Акт успішно створено');
      setModalVisible(false);
      form.resetFields();
      fetchActs();
    } catch (error) {
      message.error('Помилка при створенні акту');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Номер акту',
      dataIndex: 'act_number',
      key: 'act_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/acts/${record.act_id}`)}>{text}</a>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'act_type',
      key: 'act_type',
      width: 120,
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
      title: 'Інв. номер',
      dataIndex: 'inventory_number',
      key: 'inventory_number',
    },
    {
      title: 'Опис майна',
      dataIndex: 'asset_description',
      key: 'asset_description',
      ellipsis: true,
    },
    {
      title: 'Від підрозділу',
      dataIndex: 'from_department_name',
      key: 'from_department_name',
    },
    {
      title: 'До підрозділу',
      dataIndex: 'to_department_name',
      key: 'to_department_name',
    },
    {
      title: 'Створив',
      dataIndex: 'created_by_username',
      key: 'created_by_username',
    },
  ];

  const actTypes = [
    { value: 'introduction', label: 'Введення в експлуатацію' },
    { value: 'transfer', label: 'Передача між підрозділами' },
    { value: 'write_off', label: 'Списання' },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Акти
            </Title>
            <Text type="secondary">Документообіг</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            Створити акт
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <Space wrap>
            <Select
              placeholder="Тип акту"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => fetchActs({ act_type: value })}
            >
              {actTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchActs()}>
              Оновити
            </Button>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={acts}
            rowKey="act_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Всього: ${total}`,
              onChange: (newPage) => setPagination((prev) => ({ ...prev, current: newPage })),
            }}
          />
        </Card>
      </Space>

      {/* Create Act Modal */}
      <Modal
        title="Створити акт"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setModalType(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAct}>
          <Form.Item
            label="Тип акту"
            name="act_type"
            rules={[{ required: true, message: 'Оберіть тип акту' }]}
          >
            <Select
              placeholder="Оберіть тип акту"
              onChange={(value) => setModalType(value)}
            >
              {actTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Номер акту"
            name="act_number"
            rules={[{ required: true, message: 'Введіть номер акту' }]}
          >
            <Input placeholder="Наприклад: А-2024-001" />
          </Form.Item>

          <Form.Item
            label="Дата акту"
            name="act_date"
            rules={[{ required: true, message: 'Оберіть дату акту' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>

          {modalType === 'introduction' && (
            <>
              <Form.Item
                label="Інвентарний номер"
                name="inventory_number"
                rules={[{ required: true, message: 'Введіть інвентарний номер' }]}
              >
                <Input placeholder="Наприклад: ІН-2024-001" />
              </Form.Item>

              <Form.Item
                label="Опис майна"
                name="description"
                rules={[{ required: true, message: 'Введіть опис майна' }]}
              >
                <Input.TextArea rows={3} placeholder="Опис майна" />
              </Form.Item>
            </>
          )}

          {modalType === 'transfer' && (
            <>
              <Form.Item
                label="ID майна"
                name="asset_id"
                rules={[{ required: true, message: 'Введіть ID майна' }]}
              >
                <Input type="number" placeholder="ID майна" />
              </Form.Item>

              <Form.Item
                label="Підрозділ-отримувач"
                name="to_department_id"
                rules={[{ required: true, message: 'Введіть ID підрозділу-отримувача' }]}
              >
                <Input type="number" placeholder="ID підрозділу" />
              </Form.Item>
            </>
          )}

          {modalType === 'write_off' && (
            <Form.Item
              label="ID майна"
              name="asset_id"
              rules={[{ required: true, message: 'Введіть ID майна' }]}
            >
              <Input type="number" placeholder="ID майна" />
            </Form.Item>
          )}

          {modalType && (
            <Form.Item label="Нотатки" name="notes">
              <Input.TextArea rows={2} placeholder="Додаткові нотатки" />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Скасувати</Button>
              <Button type="primary" htmlType="submit">
                Створити
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActsPage;
