(function () {
    'use strict';

    angular
        .module('crowdsource.task.controllers')
        .controller('TaskOverviewController', TaskOverviewController);

    TaskOverviewController.$inject = ['$window', '$location', '$scope', '$mdToast', 'Task',
        '$filter', '$routeParams', 'Authentication', 'RankingService', '$rootScope'];

    /**
     * @namespace TaskOverviewController
     */
    function TaskOverviewController($window, $location, $scope, $mdToast, Task,
                               $filter, $routeParams, Authentication, RankingService, $rootScope) {
        var self = this;
        self.tasks = [];
        self.getStatusName = getStatusName;
        self.get_answer = get_answer;
        self.toggleAll = toggleAll;
        self.toggle = toggle;
        self.isSelected = isSelected;
        self.selectedItems = [];
        self.updateStatus = updateStatus;
        self.downloadResults = downloadResults;
        self.navigateToMyProjects = navigateToMyProjects;
        self.expand = expand;
        self.handleRatingSubmit = handleRatingSubmit;

        self.sort = sort;
        self.config = {
            order_by: "",
            order: ""
        };

        self.expandedRow = null;

        activate();

        function activate(){
            var project_id = $routeParams.projectId;
            getTasks(project_id);
        }

        function getTasks(project_id){
            Task.getTasks(project_id).then(
                function success(response) {
                    self.tasks = response[0].tasks;
                    self.project_name = response[0].project_name;
                    self.project_description = response[0].project_description;

                    getWorkerData(project_id);
                },
                function error(response) {
                    $mdToast.showSimple('Could not get tasks for project.');
                }
            ).finally(function () {});
        }

        function getWorkerData(project_id) {
            self.workerRankings = [];
            self.rankings = {};
            self.loadingRankings = true;

            RankingService.getWorkerRankingsByProject(project_id).then(
                function success(resp) {
                    var data = resp[0];
                    data = data.map(function (item) {
                        item.reviewType = 'requester';

                        if(item.hasOwnProperty('id') && item.id){
                            item.current_rating_id=item.id;
                        }

                        if(item.hasOwnProperty('weight') && item.weight){
                            item.current_rating=item.weight;
                        }

                        // attach to task based on worker alias
                        self.rankings[item.alias] = item;

                        return item;
                    });

                    self.workerRankings = data;

                },
                function error(resp) {
                    var data = resp[0];
                    $mdToast.showSimple('Could not get worker rankings.');
                }).finally(function(){
                    self.loadingRankings = false;
                });
        }

        function handleRatingSubmit(rating, entry) {
            if (entry && entry.hasOwnProperty('current_rating_id') && entry.current_rating_id) {
                RankingService.updateRating(rating, entry).then(function success(resp) {
                    entry.current_rating = rating;
                }, function error(resp) {
                    $mdToast.showSimple('Could not update rating.');
                }).finally(function () {

                });
            } else {
                RankingService.submitRating(rating, entry).then(function success(resp) {
                    entry.current_rating_id = resp[0].id;
                    entry.current_rating = rating;
                }, function error(resp) {
                    $mdToast.showSimple('Could not submit rating.')
                }).finally(function () {

                });
            }

        }

        function getStatusName (status) {
            if(status == 1) {
                return 'In Progress';
            }
            else if(status == 2){
                return 'Submitted';
            }
            else if(status == 3){
                return 'Accepted';
            }
            else if(status == 4){
                return 'Rejected';
            }
            else if(status == 5){
                return 'Returned';
            }
        }

        function toggleAll() {
            if(!self.selectedItems.length) {
                angular.forEach(self.tasks, function(obj) {
                    angular.forEach(obj.task_workers_monitoring, function(task_worker) {
                        self.selectedItems.push(task_worker);
                    });
                });
                self.selectAll = true;
            } else {
                self.selectedItems = [];
                self.selectAll = false;
            }
        }

        function toggle(item) {
            var idx = self.selectedItems.indexOf(item);
            if (idx > -1) {
                self.selectedItems.splice(idx, 1);
            }
            else {
                self.selectedItems.push(item);
            }
        }

        function expand(item){
            // handle previous expansion
            if(self.expandedRow && self.expandedRow.hasOwnProperty('expanded') && self.expandedRow!==item){
                self.expandedRow.expanded=false;
            }

            // toggle expansion
            if(item){
                if(item.hasOwnProperty('expanded') && item.expanded){
                    item.expanded = false;
                }else {
                    item.expanded = true;
                    self.expandedRow = item;
                }
            }
        }

        function isSelected(item){
            return !(self.selectedItems.indexOf(item) < 0);
        }

        function sort(header){
            var sortedData = $filter('orderBy')(self.myProjects, header, self.config.order==='descending');
            self.config.order = (self.config.order==='descending')?'ascending':'descending';
            self.config.order_by = header;
            self.tasks = sortedData;
        }

        function get_answer(answer_list, template_item){
            return _.find(answer_list,function(item){
                return item.template_item_id == template_item.id;
            });
        }

        function updateStatus(status_id){
            var request_data = {
                task_status: status_id,
                task_workers: []
            };
            angular.forEach(self.selectedItems, function(obj) {
                request_data.task_workers.push(obj.id);
            });
            Task.updateStatus(request_data).then(
                function success(response) {
                    self.selectedItems = [];
                    self.selectAll = false;
                    var updated_task_workers = response[0];
                    angular.forEach(updated_task_workers, function(updated_task_worker) {
                        for(var i = 0; i < self.tasks.length; i++) {
                            var task = self.tasks[i];
                            if(task.id == updated_task_worker.task) {
                                var task_index = i;
                                var task_workers = task.task_workers_monitoring;
                                for(var j = 0; j < task_workers.length; j++) {
                                    if(task_workers[j].id == updated_task_worker.id) {
                                        var task_worker_index = j;
                                        self.tasks[task_index].task_workers_monitoring[task_worker_index] = 
                                            updated_task_worker;
                                        break;
                                    } 
                                }
                                break;
                            }
                        }
                    });
                },
                function error(response) {

                }
            ).finally(function () {});
        }

        function downloadResults() {

            var params = {
                project_id: $routeParams.projectId
            };

            Task.downloadResults(params).then(
                function success(response) {
                    var a  = document.createElement('a');
                    a.href = 'data:text/csv;charset=utf-8,' + response[0].replace(/\n/g, '%0A');
                    a.target = '_blank';
                    a.download = self.project_name.replace(/\s/g,'') + '_data.csv';
                    document.body.appendChild(a);
                    a.click();
                },
                function error(response) {

                }
            ).finally(function () {});
        }

        function navigateToMyProjects() {
            $location.path('/my-projects');
        }

    }
})();