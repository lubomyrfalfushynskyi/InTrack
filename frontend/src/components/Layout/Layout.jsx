import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Badge, Space, Drawer, Button } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const { Header, Sider, Content } = AntLayout;

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Дашборд', onClick: () => navigate('/') },
    { key: '/assets', icon: <InboxOutlined />, label: 'Майно', onClick: () => navigate('/assets') },
    { key: '/acts', icon: <FileTextOutlined />, label: 'Акти', onClick: () => navigate('/acts') },
    { key: '/asset-types', icon: <AppstoreOutlined />, label: 'Види майна', onClick: () => navigate('/asset-types'), visible: user?.role === 'global_admin' },
    { key: '/locations', icon: <EnvironmentOutlined />, label: 'Приміщення', onClick: () => navigate('/locations') },
    { key: '/users', icon: <TeamOutlined />, label: 'Користувачі', onClick: () => navigate('/users'), visible: ['global_admin', 'department_admin'].includes(user?.role) },
    { key: '/logs', icon: <HistoryOutlined />, label: 'Журнал', onClick: () => navigate('/logs'), visible: ['global_admin', 'global_supervisor', 'department_admin'].includes(user?.role) },
  ].filter((item) => item.visible !== false);

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профіль',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Вийти',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const sidebarContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0' : '0 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {!collapsed && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
              Облік Майна
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Asset Management</div>
          </div>
        )}
      </div>

      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        style={{ flex: 1, borderRight: 0 }}
      />

      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
          {user?.full_name || user?.username}
        </div>
        <div style={{ fontSize: 11, color: '#bfbfbf' }}>
          {user?.role === 'global_admin' && 'Глобальний адмін'}
          {user?.role === 'global_supervisor' && 'Супервізор'}
          {user?.role === 'department_admin' && 'Адмін підрозділу'}
          {user?.role === 'editor' && 'Редактор'}
          {user?.role === 'viewer' && 'Переглядач'}
        </div>
      </div>
    </div>
  );

  return (
    <AntLayout className="app-layout">
      {/* Desktop Sidebar */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={80}
        style={{
          display: 'none',
          lg: 'display: block',
          background: '#fff',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        {sidebarContent}
      </Sider>

      {/* Mobile Header */}
      <Header
        style={{
          background: '#fff',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          lg: 'display: none',
        }}
      >
        <Button
          type="text"
          icon={mobileDrawerOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
        />

        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
          </Space>
        </Dropdown>
      </Header>

      {/* Mobile Drawer */}
      <Drawer
        title="Меню"
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        bodyStyle={{ padding: 0 }}
        lg="display: none"
      >
        {sidebarContent}
      </Drawer>

      {/* Main Content */}
      <AntLayout
        style={{
          lg: { marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' },
          transition: 'all 0.2s',
        }}
      >
        {/* Desktop Header */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'none',
            lg: 'display: flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space size="middle">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <div style={{ fontSize: 14, color: '#8c8c8c' }}>
              {menuItems.find((item) => item.key === location.pathname)?.label}
            </div>
          </Space>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Badge>
                <Avatar icon={<UserOutlined />} />
              </Badge>
              <span style={{ fontSize: 14 }}>
                {user?.full_name || user?.username}
              </span>
            </Space>
          </Dropdown>
        </Header>

        <Content className="site-layout">
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
