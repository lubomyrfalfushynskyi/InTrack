import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  message,
  Divider,
  Descriptions,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChangePassword = async (values) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/auth/change-password', values, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success('Пароль успішно змінено');
      form.resetFields();
    } catch (error) {
      message.error(error.response?.data?.message || 'Помилка при зміні пароля');
    } finally {
      setLoading(false);
    }
  };

  const [form] = Form.useForm();

  const roleLabels = {
    global_admin: 'Глобальний адміністратор',
    department_admin: 'Адміністратор підрозділу',
    editor: 'Редактор',
    viewer: 'Переглядач',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ marginBottom: 16 }}
          >
            Назад
          </Button>
          <Title level={2}>Профіль користувача</Title>
        </div>

        {/* User Info Card */}
        <Card title="Інформація про користувача">
          <Descriptions column={2}>
            <Descriptions.Item label="Логін">{user?.username}</Descriptions.Item>
            <Descriptions.Item label="Повне ім'я">{user?.full_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Роль">{roleLabels[user?.role]}</Descriptions.Item>
            <Descriptions.Item label="ID користувача">{user?.userId}</Descriptions.Item>
            <Descriptions.Item label="ID підрозділу">{user?.departmentId || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Change Password Card */}
        <Card title="Зміна пароля" icon={<LockOutlined />}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleChangePassword}
            style={{ maxWidth: 400 }}
          >
            <Form.Item
              label="Поточний пароль"
              name="currentPassword"
              rules={[{ required: true, message: 'Введіть поточний пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Поточний пароль"
              />
            </Form.Item>

            <Form.Item
              label="Новий пароль"
              name="newPassword"
              rules={[
                { required: true, message: 'Введіть новий пароль' },
                { min: 6, message: 'Пароль має бути не менше 6 символів' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Новий пароль (мінімум 6 символів)"
              />
            </Form.Item>

            <Form.Item
              label="Підтвердіть новий пароль"
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Підтвердіть новий пароль' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Паролі не збігаються'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Підтвердіть новий пароль"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                Змінити пароль
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Security Info */}
        <Card title="Інформація безпеки">
          <Space direction="vertical" size="small">
            <Text type="secondary">
              • Змініть пароль регулярно для безпеки вашого акаунту
            </Text>
            <Text type="secondary">
              • Використовуйте складні паролі з літерами, цифрами та спеціальними символами
            </Text>
            <Text type="secondary">
              • Не передавайте свої облікові дані третім особам
            </Text>
            <Text type="secondary">
              • Якщо ви підозрюєте несанкціонований доступ, негайно змініть пароль і зверніться до адміністратора
            </Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default ProfilePage;
