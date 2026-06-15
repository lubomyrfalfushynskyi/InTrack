import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await login(values);

      if (result.success) {
        message.success('Вхід успішний!');
        navigate('/');
      } else {
        message.error(result.error || 'Помилка входу');
      }
    } catch (error) {
      message.error('Помилка з\'єднання з сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32 rgba(0,0,0,0.1)',
          borderRadius: '12px',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              Облік Майна
            </Title>
            <Text type="secondary">Система управління активами</Text>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Введіть логін' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Логін"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введіть пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Пароль"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
              >
                Увійти
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Облікові дані за замовчуванням:<br />
              Логін: <Text strong>admin</Text> | Пароль: <Text strong>admin</Text>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
