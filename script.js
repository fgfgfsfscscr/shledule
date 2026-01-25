class ScheduleApp {
    constructor() {
        this.currentDate = new Date();
        this.tasks = [];
        this.config = this.loadConfig();
        this.init();
    }

    async init() {
        this.bindEvents();
        this.updateDateDisplay();
        
        // Показать настройки если не настроено
        if (!this.config.token || !this.config.repo) {
            this.showConfigModal();
        } else {
            await this.loadTasksFromGitHub();
            this.renderTasks();
        }
    }

    bindEvents() {
        // Навигация по датам
        document.getElementById('prevDay').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
            this.updateDateDisplay();
            this.renderTasks();
        });

        document.getElementById('nextDay').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
            this.updateDateDisplay();
            this.renderTasks();
        });

        // Модальное окно задач
        const modal = document.getElementById('taskModal');
        const addBtn = document.getElementById('addTaskBtn');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancelBtn');

        addBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.resetForm();
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.resetForm();
        });

        // Модальное окно настроек
        const configModal = document.getElementById('configModal');
        const configBtn = document.getElementById('configBtn');
        const configClose = document.querySelector('#configModal .close');
        const configCancel = document.getElementById('configCancelBtn');

        configBtn.addEventListener('click', () => {
            configModal.style.display = 'block';
        });

        configClose.addEventListener('click', () => {
            configModal.style.display = 'none';
        });

        configCancel.addEventListener('click', () => {
            configModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                this.resetForm();
            }
            if (e.target === configModal) {
                configModal.style.display = 'none';
            }
        });

        // Форма задач
        document.getElementById('isPeriod').addEventListener('change', (e) => {
            this.togglePeriodGroup(e.target.checked);
        });

        document.getElementById('isRecurring').addEventListener('change', (e) => {
            this.toggleRecurringGroup(e.target.checked);
        });

        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Форма настроек
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfig();
        });
    }

    updateDateDisplay() {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = 
            this.currentDate.toLocaleDateString('ru-RU', options);
    }

    togglePeriodGroup(show) {
        const periodGroup = document.getElementById('periodGroup');
        if (show) {
            periodGroup.classList.remove('hidden');
        } else {
            periodGroup.classList.add('hidden');
        }
    }

    toggleRecurringGroup(show) {
        const recurringGroup = document.getElementById('recurringGroup');
        if (show) {
            recurringGroup.classList.remove('hidden');
        } else {
            recurringGroup.classList.add('hidden');
        }
    }

    async addTask() {
        const title = document.getElementById('taskTitle').value;
        const time = document.getElementById('taskTime').value;
        const isPeriod = document.getElementById('isPeriod').checked;
        const isRecurring = document.getElementById('isRecurring').checked;
        
        const task = {
            id: Date.now(),
            title,
            time,
            isPeriod,
            isRecurring,
            completed: {},
            createdAt: new Date().toISOString()
        };

        // Если задача с периодом времени
        if (isPeriod) {
            task.endTime = document.getElementById('endTime').value;
        }

        // Если повторяющаяся задача
        if (isRecurring) {
            task.days = Array.from(document.querySelectorAll('#recurringGroup input:checked'))
                .map(cb => parseInt(cb.value));
        } else {
            // Если не повторяющаяся, привязываем к текущей дате
            task.date = this.formatDate(this.currentDate);
        }

        this.tasks.push(task);
        await this.saveTasksToGitHub();
        this.renderTasks();
        
        document.getElementById('taskModal').style.display = 'none';
        this.resetForm();
    }

    resetForm() {
        document.getElementById('taskForm').reset();
        document.getElementById('periodGroup').classList.add('hidden');
        document.getElementById('recurringGroup').classList.add('hidden');
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        const todayTasks = this.getTasksForDate(this.currentDate);

        if (todayTasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <h3>Нет задач на этот день</h3>
                    <p>Добавьте новую задачу, чтобы начать планирование</p>
                </div>
            `;
            return;
        }

        // Сортировка задач по времени
        todayTasks.sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
        });

        tasksList.innerHTML = todayTasks.map(task => this.renderTask(task)).join('');

        // Привязка событий для чекбоксов и кнопок удаления
        tasksList.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                await this.toggleTaskCompletion(parseInt(e.target.dataset.taskId));
            });
        });

        tasksList.querySelectorAll('.task-delete').forEach(button => {
            button.addEventListener('click', async (e) => {
                await this.deleteTask(parseInt(e.target.dataset.taskId));
            });
        });
    }

    renderTask(task) {
        const dateKey = this.formatDate(this.currentDate);
        const isCompleted = task.completed[dateKey] || false;
        
        let timeDisplay = '';
        let typeLabels = '';

        // Отображение времени
        if (task.isPeriod && task.endTime) {
            timeDisplay = `${task.time || '00:00'} - ${task.endTime}`;
        } else if (task.time) {
            timeDisplay = `в ${task.time}`;
        }

        // Метки типов задач
        if (task.isPeriod) {
            typeLabels += '<span class="task-period">Период</span>';
        }
        if (task.isRecurring) {
            typeLabels += '<span class="task-recurring">Повторяется</span>';
        }

        return `
            <div class="task-item ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" 
                       data-task-id="${task.id}" ${isCompleted ? 'checked' : ''}>
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-time">${timeDisplay} ${typeLabels}</div>
                </div>
                <button class="task-delete" data-task-id="${task.id}">×</button>
            </div>
        `;
    }

    getTasksForDate(date) {
        const dateKey = this.formatDate(date);
        const dayOfWeek = date.getDay();

        return this.tasks.filter(task => {
            if (task.isRecurring) {
                // Повторяющаяся задача - проверяем дни недели
                return task.days && task.days.includes(dayOfWeek);
            } else {
                // Обычная задача - проверяем дату
                return task.date === dateKey;
            }
        });
    }

    async toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const dateKey = this.formatDate(this.currentDate);
        task.completed[dateKey] = !task.completed[dateKey];
        
        await this.saveTasksToGitHub();
        this.renderTasks();
    }

    async deleteTask(taskId) {
        if (confirm('Удалить эту задачу?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            await this.saveTasksToGitHub();
            this.renderTasks();
        }
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // GitHub синхронизация
    async loadTasksFromGitHub() {
        if (!this.config.token || !this.config.repo) return;

        try {
            const response = await fetch(`https://api.github.com/repos/${this.config.repo}/contents/schedule-data.json`, {
                headers: {
                    'Authorization': `Bearer ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
                this.tasks = content.tasks || [];
                this.fileSha = data.sha;
            } else if (response.status === 404) {
                // Файл не существует, создаем пустой
                this.tasks = [];
                await this.saveTasksToGitHub();
            } else {
                const errorData = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showError(`Ошибка загрузки: ${error.message}`);
        }
    }

    async saveTasksToGitHub() {
        if (!this.config.token || !this.config.repo) return;

        try {
            const content = btoa(unescape(encodeURIComponent(JSON.stringify({
                tasks: this.tasks,
                lastUpdated: new Date().toISOString()
            }))));

            const body = {
                message: 'Обновление расписания',
                content: content
            };

            if (this.fileSha) {
                body.sha = this.fileSha;
            }

            const response = await fetch(`https://api.github.com/repos/${this.config.repo}/contents/schedule-data.json`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const data = await response.json();
                this.fileSha = data.content.sha;
            } else {
                const errorData = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            this.showError(`Ошибка сохранения: ${error.message}`);
        }
    }

    showConfigModal() {
        document.getElementById('configModal').style.display = 'block';
    }

    async saveConfig() {
        const token = document.getElementById('githubToken').value;
        const repo = document.getElementById('githubRepo').value;

        if (!token || !repo) {
            this.showError('Заполните все поля');
            return;
        }

        this.config = { token, repo };
        localStorage.setItem('scheduleConfig', JSON.stringify(this.config));

        document.getElementById('configModal').style.display = 'none';
        
        await this.loadTasksFromGitHub();
        this.renderTasks();
    }

    loadConfig() {
        try {
            const saved = localStorage.getItem('scheduleConfig');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    showError(message) {
        // Простое уведомление об ошибке
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f85149;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1001;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    loadTasks() {
        // Оставляем для обратной совместимости
        try {
            const saved = localStorage.getItem('scheduleTasks');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Ошибка загрузки задач:', e);
            return [];
        }
    }

    saveTasks() {
        // Оставляем для обратной совместимости
        try {
            localStorage.setItem('scheduleTasks', JSON.stringify(this.tasks));
        } catch (e) {
            console.error('Ошибка сохранения задач:', e);
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new ScheduleApp();
});