import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Card,
  Space,
  Button,
  Tag,
  Input,
  Select,
  Typography,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LockOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const UsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize]);

  const fetchUsers = async (params = {}) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          ...params,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(response.data.data);
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

  const handleCreateUser = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/users', values, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Користувача успішно створено');
      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('Помилка при створенні користувача');
      console.error(error);
    }
  };

  const handleUpdateUser = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/users/${currentUser.user_id}`, values, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Користувача успішно оновлено');
      setModalVisible(false);
      form.resetFields();
      setCurrentUser(null);
      fetchUsers();
    } catch (error) {
      message.error('Помилка при оновленні користувача');
      console.error(error);
    }
  };

  const handleDeleteUser = async (user) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/users/${user.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Користувача успішно видалено');
      fetchUsers();
    } catch (error) {
      message.error('Помилка при видаленні користувача');
      console.error(error);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setCurrentUser(user);
    form.setFieldsValue({
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id,
      is_active: user.is_active,
    });
    setModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 60,
    },
    {
      title: 'Логін',
      dataIndex: 'username',
      key: 'username',
      sorter: true,
    },
    {
      title: 'ПІБ',
      dataIndex: 'full_name',
      key: 'full_name',
      ellipsis: true,
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role) => {
        const colors = {
          global_admin: 'orange',
          department_admin: 'green',
          editor: 'blue',
          viewer: 'default',
        };
        const labels = {
          global_admin: 'Глобальний адмін',
          department_admin: 'Адмін підрозділу',
          editor: 'Редактор',
          viewer: 'Переглядач',
        };
        return <Tag color={colors[role]}>{labels[role]}</Tag>;
      },
    },
    {
      title: 'Підрозділ',
      dataIndex: 'department_name',
      key: 'department_name',
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Активний' : 'Деактивовано'}
        </Tag>
      ),
    },
    {
      title: 'Останній вхід',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date) => (date ? new Date(date).toLocaleString('uk-UA') : '-'),
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Видалити користувача?"
            description="Ця дія незворотна"
            onConfirm={() => handleDeleteUser(record)}
            okText="Так"
            cancelText="Ні"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Користувачі
            </Title>
            <Text type="secondary">Управління користувачами та правами доступу</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Додати користувача
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <Space wrap>
            <Select
              placeholder="Роль"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => fetchUsers({ role: value })}
            >
              <Option value="global_admin">Глобальний адмін</Option>
              <Option value="department_admin">Адмін підрозділу</Option>
              <Option value="editor">Редактор</Option>
              <Option value="viewer">Переглядач</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()}>
              Оновити
            </Button>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="user_id"
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

      {/* Create/Edit User Modal */}
      <Modal
        title={modalMode === 'create' ? 'Створити користувача' : 'Редагувати користувача'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setCurrentUser(null);
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={modalMode === 'create' ? handleCreateUser : handleUpdateUser}
        >
          <Form.Item
            label="Логін"
            name="username"
            rules={[{ required: true, message: 'Введіть логін' }]}
          >
            <Input placeholder="username" disabled={modalMode === 'edit'} />
          </Form.Item>

          <Form.Item
            label="ПІБ"
            name="full_name"
          >
            <Input placeholder="Повне ім'я" />
          </Form.Item>

          <Form.Item
            label="Роль"
            name="role"
            rules={[{ required: true, message: 'Оберіть роль' }]}
          >
            <Select placeholder="Оберіть роль">
              <Option value="global_admin">Глобальний адмін</Option>
              <Option value="department_admin">Адмін підрозділу</Option>
              <Option value="editor">Редактор</Option>
              <Option value="viewer">Переглядач</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="ID підрозділу"
            name="department_id"
          >
            <Input type="number" placeholder="ID підрозділу (необов'язково)" />
          </Form.Item>

          {modalMode === 'create' && (
            <Form.Item
              label="Пароль"
              name="password"
              rules={[{ required: true, message: 'Введіть пароль' }]}
            >
              <Input.Password placeholder="Мінімум 6 символів" />
            </Form.Item>
          )}

          {modalMode === 'edit' && (
            <Form.Item
              label="Новий пароль"
              name="password"
            >
              <Input.Password placeholder="Залиште пустим, якщо не змінюєте" />
            </Form.Item>
          )}

          <Form.Item
            name="is_active"
            valuePropName="checked"
            initialValue={true}
          >
            <Button type="primary" htmlType="submit" block>
              {modalMode === 'create' ? 'Створити' : 'Зберегти'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
