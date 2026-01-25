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

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.updateDateDisplay();
            this.renderTasks();
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N - новая задача
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                document.getElementById('taskModal').style.display = 'block';
            }
            // Стрелка влево - предыдущий день
            if (e.key === 'ArrowLeft' && !this.isModalOpen()) {
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                this.updateDateDisplay();
                this.renderTasks();
            }
            // Стрелка вправо - следующий день
            if (e.key === 'ArrowRight' && !this.isModalOpen()) {
                this.currentDate.setDate(this.currentDate.getDate() + 1);
                this.updateDateDisplay();
                this.renderTasks();
            }
            // T - вернуться к сегодня
            if (e.key === 't' && !this.isModalOpen()) {
                this.currentDate = new Date();
                this.updateDateDisplay();
                this.renderTasks();
            }
        });

        // Модальное окно задач
        const modal = document.getElementById('taskModal');
        const addBtn = document.getElementById('addTaskBtn');
        const closeBtn = document.getElementById('taskClose');
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
        const configClose = document.getElementById('configClose');
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

        // Используем делегирование событий для динамических элементов
        this.attachTaskEvents();
    }

    attachTaskEvents() {
        const tasksList = document.getElementById('tasksList');
        
        // Удаляем старые обработчики если есть
        const oldTasksList = tasksList.cloneNode(true);
        tasksList.parentNode.replaceChild(oldTasksList, tasksList);
        
        // Добавляем новые обработчики через делегирование
        document.getElementById('tasksList').addEventListener('click', async (e) => {
            // Обработка чекбокса
            if (e.target.classList.contains('task-checkbox')) {
                const taskId = parseInt(e.target.dataset.taskId);
                await this.toggleTaskCompletion(taskId);
            }
            
            // Обработка кнопки удаления
            if (e.target.classList.contains('task-delete')) {
                e.preventDefault();
                e.stopPropagation();
                const taskId = parseInt(e.target.dataset.taskId);
                await this.deleteTask(taskId);
            }
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
                // Повторяющаяся задача - проверяем дни недели и исключения
                const isOnThisDay = task.days && task.days.includes(dayOfWeek);
                const isExcluded = task.excludedDates && task.excludedDates.includes(dateKey);
                return isOnThisDay && !isExcluded;
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
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Если задача повторяющаяся, предлагаем выбор
        if (task.isRecurring) {
            const choice = await this.showDeleteChoice();
            
            if (choice === 'cancel') return;
            
            if (choice === 'this') {
                // Удаляем только это событие - добавляем дату в исключения
                const dateKey = this.formatDate(this.currentDate);
                if (!task.excludedDates) {
                    task.excludedDates = [];
                }
                task.excludedDates.push(dateKey);
            } else if (choice === 'all') {
                // Удаляем всю повторяющуюся задачу
                this.tasks = this.tasks.filter(t => t.id !== taskId);
            }
        } else {
            // Обычная задача - просто удаляем
            if (!confirm('Удалить эту задачу?')) return;
            this.tasks = this.tasks.filter(t => t.id !== taskId);
        }

        await this.saveTasksToGitHub();
        this.renderTasks();
    }

    showDeleteChoice() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <h2 style="margin-bottom: 20px;">Удалить задачу</h2>
                    <p style="margin-bottom: 24px; color: #8b949e;">Это повторяющаяся задача. Что вы хотите удалить?</p>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn-primary" id="deleteThis">Только это событие</button>
                        <button class="btn-secondary" id="deleteAll" style="background: #da3633; color: white; border: none;">Все повторения</button>
                        <button class="btn-secondary" id="deleteCancel">Отмена</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cleanup = (choice) => {
                modal.remove();
                resolve(choice);
            };
            
            modal.querySelector('#deleteThis').addEventListener('click', () => cleanup('this'));
            modal.querySelector('#deleteAll').addEventListener('click', () => cleanup('all'));
            modal.querySelector('#deleteCancel').addEventListener('click', () => cleanup('cancel'));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cleanup('cancel');
            });
        });
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
                // Декодируем base64 и парсим JSON
                const jsonString = new TextDecoder().decode(
                    Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
                );
                const content = JSON.parse(jsonString);
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
            // Кодируем JSON в base64
            const jsonString = JSON.stringify({
                tasks: this.tasks,
                lastUpdated: new Date().toISOString()
            });
            const bytes = new TextEncoder().encode(jsonString);
            const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
            const content = btoa(binString);

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

    isModalOpen() {
        const modals = document.querySelectorAll('.modal');
        return Array.from(modals).some(modal => modal.style.display === 'block');
    }

    // Дополнительные полезные функции
    
    // Получить статистику задач
    getTaskStats() {
        const today = this.formatDate(new Date());
        const todayTasks = this.getTasksForDate(new Date());
        const completed = todayTasks.filter(task => task.completed[today]).length;
        
        return {
            total: this.tasks.length,
            today: todayTasks.length,
            completed: completed,
            pending: todayTasks.length - completed
        };
    }

    // Экспорт задач в JSON
    exportTasks() {
        const dataStr = JSON.stringify(this.tasks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `schedule-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Импорт задач из JSON
    async importTasks(file) {
        try {
            const text = await file.text();
            const importedTasks = JSON.parse(text);
            
            if (confirm(`Импортировать ${importedTasks.length} задач? Это добавит их к существующим.`)) {
                this.tasks = [...this.tasks, ...importedTasks];
                await this.saveTasksToGitHub();
                this.renderTasks();
                this.showSuccess('Задачи успешно импортированы');
            }
        } catch (error) {
            this.showError('Ошибка импорта: ' + error.message);
        }
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #238636;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1001;
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
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
