import React, { useEffect, useState, useMemo } from 'react';
import { Card, Tree, Button, Typography, Space, Modal, Form, Input, Select, message, List, Tag, Empty, Dropdown, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, EnvironmentOutlined, ApartmentOutlined, DeleteOutlined, EditOutlined, FolderAddOutlined } from '@ant-design/icons';
import { locationsAPI, departmentsAPI, regionsAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import InfoButton from '../components/InfoButton';

const { Title, Text } = Typography;

// 6 областей з >1 підрозділом — фіксований порядок
const BLOCK_REGIONS = [
  { prefix: 'Київськ', name: 'Київська' },
  { prefix: 'Харківськ', name: 'Харківська' },
  { prefix: 'Полтавськ', name: 'Полтавська' },
  { prefix: 'Рівненськ', name: 'Рівненська' },
  { prefix: 'Одеськ', name: 'Одеська' },
  { prefix: 'Житомирськ', name: 'Житомирська' }
];

const LocationsPage = () => {
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sel, setSel] = useState(null);
  const [assetsList, setAssetsList] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const { user } = useAuthStore();

  // Нові стани для підрозділів та областей
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptForm] = Form.useForm();
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [regionForm] = Form.useForm();
  const [regionSubmitting, setRegionSubmitting] = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);

  const load = async () => { setLoading(true); try { const r = await locationsAPI.getAll(); setLocations(r.data); } catch (e) { message.error('Помилка'); } finally { setLoading(false); } };
  const loadRegions = async () => { try { const r = await regionsAPI.getAll(); setRegions(r.data); } catch (e) { message.error('Помилка завантаження областей'); } };
  const loadDepartments = async () => { try { const r = await departmentsAPI.getAll(); setDepartments(r.data); } catch (e) { message.error('Помилка завантаження підрозділів'); } };
  useEffect(() => { load(); loadRegions(); loadDepartments(); }, []);

  const grouped = useMemo(() => {
    const byDept = {};
    locations.forEach((l) => { (byDept[l.department_id] = byDept[l.department_id] || { name: l.department_name, items: [] }).items.push(l); });
    return byDept;
  }, [locations]);

  // Групування підрозділів за областями (використовує regions з API)
  const groupByRegion = useMemo(() => {
    const regionMap = {};

    // Ініціалізуємо regionMap з regions API
    regions.forEach((region) => {
      regionMap[region.region_id] = {
        region_id: region.region_id,
        region_name: region.region_name,
        display_order: region.display_order,
        departments: []
      };
    });

    // Групуємо підрозділи за region_id
    departments.forEach((dept) => {
      if (!grouped[dept.department_id]) return; // Пропускаємо підрозділи без приміщень

      if (dept.region_id && regionMap[dept.region_id]) {
        regionMap[dept.region_id].departments.push(dept);
      }
    });

    // Сортуємо підрозділи всередині кожної області
    Object.values(regionMap).forEach((region) => {
      region.departments.sort((a, b) => a.name.localeCompare(b.name));
    });

    return regionMap;
  }, [departments, grouped, regions]);

  // Розділяємо на блоки для відображення
  const regionBlocks = useMemo(() => {
    const blocks = Object.values(groupByRegion).filter((region) => region.departments.length > 0);

    // Сортуємо блоки: за display_order, потім за назвою
    blocks.sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.region_name.localeCompare(b.region_name);
    });

    return blocks;
  }, [groupByRegion]);

  const buildDeptTree = (dept) => {
    const items = dept.items;
    const byBuilding = {};
    items.forEach((l) => { const b = l.building || '(без будівлі)'; (byBuilding[b] = byBuilding[b] || []).push(l); });
    return Object.keys(byBuilding).sort().map((b) => ({
      title: b, key: 'b-' + dept.name + '-' + b, selectable: false,
      children: byBuilding[b].map((l) => {
        const title = [l.floor && (l.floor + 'п'), l.room && ('к.' + l.room)].filter(Boolean).join(' ') || '(приміщення)';
        const canDelete = user?.role === 'global_admin' || (user?.role === 'department_admin' && user?.department_id === l.department_id);

        return {
          title: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{title}</span>
              {canDelete && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'delete',
                        label: 'Видалити',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => handleDelete(l.location_id),
                      },
                    ],
                  }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    style={{ padding: '0 4px' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              )}
            </div>
          ),
          key: 'l-' + l.location_id,
          isLeaf: true,
          location: l,
        };
      }),
    }));
  };

  const onSelect = async (_keys, info) => {
    const node = info && info.node;
    if (node && node.location) {
      setSel(node.location); setAssetsLoading(true);
      try { const r = await locationsAPI.assets(node.location.location_id); setAssetsList(r.data); } catch (e) { message.error('Помилка'); } finally { setAssetsLoading(false); }
    }
  };

  const TreeBlock = ({ dept, expanded }) => (
    <Card size="small" title={<span><ApartmentOutlined /> {dept.name}</span>} style={{ height: '100%' }}>
      <Tree showIcon defaultExpandAll={expanded} treeData={buildDeptTree(grouped[dept.department_id])} onSelect={onSelect} />
    </Card>
  );

  const openCreate = () => { form.resetFields(); form.setFieldsValue({ department_id: (departments[0] && departments[0].department_id) }); setOpen(true); };
  const submit = async (values) => {
    setSubmitting(true);
    try { await locationsAPI.create(values); message.success('Приміщення створено'); setOpen(false); load(); }
    catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (locationId) => {
    Modal.confirm({
      title: 'Видалити приміщення?',
      content: 'Приміщення буде видалено. Майно в цьому приміщенні втратить прив\'язку до будівлі.',
      okText: 'Видалити',
      okType: 'danger',
      cancelText: 'Скасувати',
      onOk: async () => {
        try { await locationsAPI.remove(locationId); message.success('Приміщення видалено'); load(); }
        catch (e) { message.error(e.response?.data?.message || 'Помилка видалення'); }
      },
    });
  };
  const selTitle = sel ? [sel.building, sel.floor && (sel.floor + 'п'), sel.room && ('к.' + sel.room)].filter(Boolean).join(', ') : '';

  // Функції для підрозділів
  const openDeptCreate = () => {
    setEditingDept(null);
    deptForm.resetFields();
    deptForm.setFieldsValue({ region_id: regions[0]?.region_id });
    setDeptModalOpen(true);
  };

  const openDeptEdit = (dept) => {
    setEditingDept(dept);
    deptForm.setFieldsValue({ name: dept.name, region_id: dept.region_id });
    setDeptModalOpen(true);
  };

  const submitDept = async (values) => {
    setDeptSubmitting(true);
    try {
      if (editingDept) {
        await departmentsAPI.update(editingDept.department_id, values);
        message.success('Підрозділ оновлено');
      } else {
        await departmentsAPI.create(values);
        message.success('Підрозділ створено');
      }
      setDeptModalOpen(false);
      deptForm.resetFields();
      setEditingDept(null);
      // Перезавантажуємо дані
      await loadDepartments();
    } catch (e) {
      message.error(e.response?.data?.message || 'Помилка');
    } finally {
      setDeptSubmitting(false);
    }
  };

  const handleDeptDelete = async (deptId, deptName) => {
    Modal.confirm({
      title: 'Видалити підрозділ?',
      content: `Підрозділ "${deptName}" та все його майно буде видалено.`,
      okText: 'Видалити',
      okType: 'danger',
      cancelText: 'Скасувати',
      onOk: async () => {
        try {
          await departmentsAPI.remove(deptId);
          message.success('Підрозділ видалено');
          await loadDepartments();
          load();
        } catch (e) {
          message.error(e.response?.data?.message || 'Помилка видалення');
        }
      },
    });
  };

  // Функції для областей
  const openRegionCreate = () => {
    setEditingRegion(null);
    regionForm.resetFields();
    regionForm.setFieldsValue({ display_order: regions.length > 0 ? Math.max(...regions.map(r => r.display_order)) + 1 : 10 });
    setRegionModalOpen(true);
  };

  const openRegionEdit = (region) => {
    setEditingRegion(region);
    regionForm.setFieldsValue({
      region_name: region.region_name,
      display_order: region.display_order
    });
    setRegionModalOpen(true);
  };

  const submitRegion = async (values) => {
    setRegionSubmitting(true);
    try {
      if (editingRegion) {
        await regionsAPI.update(editingRegion.region_id, values);
        message.success('Область оновлено');
      } else {
        await regionsAPI.create(values);
        message.success('Область створено');
      }
      setRegionModalOpen(false);
      regionForm.resetFields();
      setEditingRegion(null);
      // Перезавантажуємо дані
      await loadRegions();
      await loadDepartments();
    } catch (e) {
      message.error(e.response?.data?.message || 'Помилка');
    } finally {
      setRegionSubmitting(false);
    }
  };

  const handleRegionDelete = async (regionId, regionName) => {
    Modal.confirm({
      title: 'Видалити область?',
      content: `Область "${regionName}" та всі її підрозділи (разом з майном) будуть видалені.`,
      okText: 'Видалити',
      okType: 'danger',
      cancelText: 'Скасувати',
      onOk: async () => {
        try {
          await regionsAPI.remove(regionId);
          message.success('Область видалено');
          await loadRegions();
          await loadDepartments();
          load();
        } catch (e) {
          message.error(e.response?.data?.message || 'Помилка видалення');
        }
      },
    });
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Приміщення</Title><Text type="secondary">Дерева підрозділів: будівлі → поверхи/кімнати</Text></div>
          <Space>
            {user?.role === 'global_admin' && (
              <>
                <Button icon={<FolderAddOutlined />} onClick={openRegionCreate}>Додати область</Button>
                <Button icon={<PlusOutlined />} onClick={openDeptCreate}>Додати підрозділ</Button>
              </>
            )}
            <InfoButton title="Приміщення" items={[
              { title: 'Створення', text: 'окремою кнопкою з меню «Майно»; в актах приміщень немає.' },
              { title: 'Структура', text: 'Київська → 6 спец-областей (Харківська, Полтавська, Рівненська, Одеська, Житомирська) → решта алфавіт. Усередині блоків підрозділи горизонтально.' },
              { title: 'Київська область', text: 'flex-відображення (підрозділів >10).' },
              { title: 'Майно в приміщенні', text: 'клік по кінцевому вузлі показує всі одиниці, що там перебувають.' },
              { title: 'Видалення', text: 'глобальний адмін — будь-які приміщення; адмін підрозділу — тільки у своєму підрозділі.' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Додати приміщення</Button>
          </Space>
        </div>

        {regionBlocks.map((region) => {
          const isKyiv = region.region_name === 'Київська';
          const isSpecial = region.display_order < 10;

          return (
            <Card
              key={region.region_id}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{region.region_name}</span>
                  {user?.role === 'global_admin' && (
                    <Space size="small">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); openRegionEdit(region); }}
                        style={{ padding: '0 4px' }}
                      />
                      {region.departments.length > 0 && (
                        <Popconfirm
                          title="Видалити область?"
                          description={`Область "${region.region_name}" та всі її підрозділи (${region.departments.length} шт.) разом з майном будуть видалені.`}
                          onConfirm={() => handleRegionDelete(region.region_id, region.region_name)}
                          okText="Видалити"
                          cancelText="Скасувати"
                          okType="danger"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            danger
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '0 4px' }}
                          />
                        </Popconfirm>
                      )}
                    </Space>
                  )}
                </div>
              }
              loading={loading}
              extra={regionBlocks.length - 1 === regionBlocks.indexOf(region) && <Button type="text" icon={<ReloadOutlined />} onClick={load} />}
              style={isSpecial ? { borderColor: '#1890ff', borderWidth: 2 } : {}}
            >
              <div style={{ display: 'flex', flexWrap: isKyiv ? 'nowrap' : 'wrap', gap: 12, overflowX: isKyiv ? 'auto' : 'visible' }}>
                {region.departments.map((dept) => (
                  <div key={dept.department_id} style={{ flex: isKyiv ? '0 0 auto' : '1 1 300px', minWidth: 280 }}>
                    <Card
                      size="small"
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span><ApartmentOutlined /> {dept.name}</span>
                          {user?.role === 'global_admin' && (
                            <Space size="small">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={(e) => { e.stopPropagation(); openDeptEdit(dept); }}
                                style={{ padding: '0 4px' }}
                              />
                              <Popconfirm
                                title="Видалити підрозділ?"
                                description={`Підрозділ "${dept.name}" та все його майно буде видалено.`}
                                onConfirm={(e) => { e?.stopPropagation(); handleDeptDelete(dept.department_id, dept.name); }}
                                onCancel={(e) => e?.stopPropagation()}
                                okText="Видалити"
                                cancelText="Скасувати"
                                okType="danger"
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  danger
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ padding: '0 4px' }}
                                />
                              </Popconfirm>
                            </Space>
                          )}
                        </div>
                      }
                      style={{ height: '100%' }}
                    >
                      <Tree
                        showIcon
                        defaultExpandAll={true}
                        treeData={buildDeptTree(grouped[dept.department_id])}
                        onSelect={onSelect}
                      />
                    </Card>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </Space>

      <Modal title="Створити приміщення" open={open} onCancel={() => setOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Підрозділ" name="department_id" rules={[{ required: true }]}><Select disabled={user?.role !== 'global_admin'}>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item label="Будівля" name="building" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Поверх (необов'язково)" name="floor"><Input /></Form.Item>
          <Form.Item label="Кімната (необов'язково)" name="room"><Input /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Створити</Button></Space></Form.Item>
        </Form>
      </Modal>

      <Modal title={editingDept ? 'Редагувати підрозділ' : 'Створити підрозділ'} open={deptModalOpen} onCancel={() => { setDeptModalOpen(false); deptForm.resetFields(); setEditingDept(null); }} footer={null} width={500}>
        <Form form={deptForm} layout="vertical" onFinish={submitDept}>
          <Form.Item label="Назва підрозділу" name="name" rules={[{ required: true, message: 'Введіть назву підрозділу' }]}><Input placeholder="Наприклад: Львівське Управління" /></Form.Item>
          <Form.Item label="Область" name="region_id" rules={[{ required: true, message: 'Виберіть область' }]}>
            <Select placeholder="Виберіть область">
              {regions.map((r) => <Select.Option key={r.region_id} value={r.region_id}>{r.region_name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => { setDeptModalOpen(false); deptForm.resetFields(); setEditingDept(null); }}>Скасувати</Button><Button type="primary" htmlType="submit" loading={deptSubmitting}>{editingDept ? 'Оновити' : 'Створити'}</Button></Space></Form.Item>
        </Form>
      </Modal>

      <Modal title={editingRegion ? 'Редагувати область' : 'Створити область'} open={regionModalOpen} onCancel={() => { setRegionModalOpen(false); regionForm.resetFields(); setEditingRegion(null); }} footer={null} width={500}>
        <Form form={regionForm} layout="vertical" onFinish={submitRegion}>
          <Form.Item label="Назва області" name="region_name" rules={[{ required: true, message: 'Введіть назву області' }]}><Input placeholder="Наприклад: Львівська" /></Form.Item>
          <Form.Item label="Порядок відображення" name="display_order" rules={[{ required: true, message: 'Введіть порядок' }]}><Input type="number" placeholder="1-6 для спец-областей, 10+ для решти" /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => { setRegionModalOpen(false); regionForm.resetFields(); setEditingRegion(null); }}>Скасувати</Button><Button type="primary" htmlType="submit" loading={regionSubmitting}>{editingRegion ? 'Оновити' : 'Створити'}</Button></Space></Form.Item>
        </Form>
      </Modal>

      <Modal title={'Майно в приміщенні: ' + selTitle} open={!!sel} onCancel={() => setSel(null)} footer={null} width={600}>
        <List loading={assetsLoading} dataSource={assetsList} locale={{ emptyText: 'Майна немає' }}
          renderItem={(a) => (<List.Item><List.Item.Meta title={`${a.inventory_number} — ${a.name}`} description={`${a.responsible_full_name || a.responsible_username || '—'} · ${a.department_name || ''}`} /><Tag>{a.status}</Tag></List.Item>)} />
      </Modal>
    </div>
  );
};

export default LocationsPage;
