import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Space, message, Descriptions } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;

const roleLabels = {
  global_admin: 'Глобальний адміністратор',
  global_supervisor: 'Глобальний супервізор',
  department_admin: 'Адміністратор підрозділу',
  editor: 'Редактор',
  viewer: 'Переглядач',
};

const ProfilePage = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleChangePassword = async (values) => {
    setLoading(true);
    try {
      await authAPI.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      message.success('Пароль успішно змінено');
      form.resetFields();
    } catch (error) {
      message.error(error.response?.data?.message || 'Помилка при зміні пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>Назад</Button>
          <Title level={2}>Профіль користувача</Title>
        </div>
        <Card title="Інформація про користувача">
          <Descriptions column={2}>
            <Descriptions.Item label="Логін">{user?.username}</Descriptions.Item>
            <Descriptions.Item label="ПІБ">{user?.fullName || user?.full_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Роль">{roleLabels[user?.role] || user?.role}</Descriptions.Item>
            <Descriptions.Item label="Підрозділ">{user?.departmentId || user?.department_id || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="Зміна пароля">
          <Form form={form} layout="vertical" onFinish={handleChangePassword} style={{ maxWidth: 400 }}>
            <Form.Item label="Поточний пароль" name="currentPassword" rules={[{ required: true, message: 'Введіть поточний пароль' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Поточний пароль" />
            </Form.Item>
            <Form.Item label="Новий пароль" name="newPassword" rules={[{ required: true, message: 'Введіть новий пароль' }, { min: 4, message: 'Мінімум 4 символи' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Новий пароль" />
            </Form.Item>
            <Form.Item label="Підтвердіть новий пароль" name="confirmPassword" dependencies={['newPassword']}
              rules={[{ required: true, message: 'Підтвердіть новий пароль' },
                ({ getFieldValue }) => ({ validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('Паролі не збігаються'));
                } })]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Підтвердіть новий пароль" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" loading={loading}>Змінити пароль</Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default ProfilePage;
