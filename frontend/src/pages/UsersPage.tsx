import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { UserForm } from "../components/forms/UserForm";
import "./DressesPage.css";

type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

function statusLabel(isActive: boolean) {
  return isActive ? "Activo" : "Inactivo";
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "staff":
      return "Staff";
    default:
      return role;
  }
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<UserRow[]>("/users");
      setRows(response.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setError("");
    setShowModal(true);
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setError("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const columns = useMemo<DataGridColumn<UserRow>[]>(() => {
    return [
      {
        key: "full_name",
        label: "Usuario",
        render: (row) => `${row.first_name} ${row.last_name}`,
      },
      {
        key: "email",
        label: "Email",
        render: (row) => row.email,
      },
      {
        key: "role",
        label: "Rol",
        render: (row) => roleLabel(row.role),
      },
      {
        key: "status",
        label: "Estado",
        render: (row) => (
          <span
            className={`df-status-badge ${
              row.is_active ? "df-status-badge--active" : "df-status-badge--draft"
            }`}
          >
            {statusLabel(row.is_active)}
          </span>
        ),
      },
    ];
  }, []);

  return (
    <section className="df-pro-page">
      <header
        className="df-pro-page__hero"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <div>
          <p className="df-pro-page__eyebrow">Gestión de acceso</p>
          <h1 className="df-pro-page__title">Usuarios</h1>
          <p className="df-pro-page__subtitle">
            Administrá usuarios, roles y estado de acceso por empresa.
          </p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          Nuevo usuario
        </PrimaryButton>
      </header>

      {error && !showModal && (
        <section className="df-pro-card">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#fdecec",
              color: "#9a2f2f",
            }}
          >
            {error}
          </div>
        </section>
      )}

      <section className="df-pro-card">
        {loading ? (
          <p>Cargando usuarios...</p>
        ) : rows.length === 0 ? (
          <p>No hay usuarios cargados.</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={handleEdit}
          />
        )}
      </section>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingUser ? "Editar usuario" : "Nuevo usuario"}
        width="min(860px, 100%)"
      >
        <UserForm
          user={editingUser}
          onSuccess={() => {
            handleCloseModal();
            void loadUsers();
          }}
          onCancel={handleCloseModal}
        />
      </Modal>
    </section>
  );
}
