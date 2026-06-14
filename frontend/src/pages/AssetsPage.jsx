import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Space,
  Input,
  Button,
  Tag,
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
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const AssetsPage = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });
  const [filters, setFilters] = useState({});
  const [searchText, setSearchText] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssets();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchAssets = async (search = searchText) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search,
        ...filters,
      };

      const response = await axios.get('/api/assets', {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setAssets(response.data.data);
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

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchAssets(value);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleDelete = async (asset) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/assets/${asset.asset_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('Майно успішно видалено');
      setDeleteModalVisible(false);
      fetchAssets();
    } catch (error) {
      message.error('Помилка при видаленні');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Інв. номер',
      dataIndex: 'inventory_number',
      key: 'inventory_number',
      sorter: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/assets/${record.asset_id}`)}>{text}</a>
      ),
    },
    {
      title: 'Опис',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: true,
    },
    {
      title: 'Підрозділ',
      dataIndex: 'department_name',
      key: 'department_name',
      sorter: true,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const colors = {
          active: 'green',
          transferred: 'blue',
          written_off: 'red',
        };
        const labels = {
          active: 'Активне',
          transferred: 'Передано',
          written_off: 'Списано',
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: 'Локація',
      dataIndex: 'location_full',
      key: 'location_full',
      ellipsis: true,
    },
    {
      title: 'Дата введення',
      dataIndex: 'primary_introduced_date',
      key: 'primary_introduced_date',
      render: (date) => (date ? new Date(date).toLocaleDateString('uk-UA') : '-'),
    },
    {
      title: 'Дії',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/assets/${record.asset_id}`)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/assets/${record.asset_id}/edit`)}
          />
          <Popconfirm
            title="Видалити майно?"
            description="Ця дія незворотна"
            onConfirm={() => handleDelete(record)}
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
              Майно
            </Title>
            <Text type="secondary">Облік та управління майном</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/assets/new')}>
            Додати майно
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <Search
                placeholder="Пошук за інвентарним номером або описом"
                allowClear
                style={{ width: 300 }}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
              />
              <Select
                placeholder="Статус"
                allowClear
                style={{ width: 150 }}
                onChange={(value) => handleFilterChange('status', value)}
              >
                <Option value="active">Активне</Option>
                <Option value="transferred">Передано</Option>
                <Option value="written_off">Списано</Option>
              </Select>
              <Button icon={<ReloadOutlined />} onClick={() => fetchAssets()}>
                Оновити
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={assets}
            rowKey="asset_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Всього: ${total}`,
            }}
            onChange={handleTableChange}
          />
        </Card>
      </Space>
    </div>
  );
};

export default AssetsPage;
