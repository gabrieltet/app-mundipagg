angular.module('fileUpload', ['ngFileUpload'])

    .controller('uploadController', ['$scope', 'Upload', '$timeout', function ($scope, Upload, $timeout) {
        $scope.$watch('files', function () {
            $scope.upload($scope.files);
        });

        $scope.log = '';

        $scope.upload = function (files) {
            if (files && files.length) {
                for (var i = 0; i < files.length; i++) {
                  var file = files[i];
                  if (!file.$error) {
                    $scope.loading = true;
                    $scope.log = 'Received ' + file.name + '\n' + $scope.log;
                    Upload.upload({
                        url: '/api/upload',
                        method: 'POST',
                        file: file  
                    }).then(function (resp) {
                        $timeout(function() {
                            $scope.log = 'file: ' +
                            file.name +
                            ' was saved to: ' + JSON.stringify(resp.config.url) +
                            '\n' + $scope.log;
                            $scope.loading = false;
                            $scope.uploadPercentage = 0;
                        });
                    }, null, function (evt) {
                        var progressPercentage = parseInt(100.0 *
                        		evt.loaded / evt.total);
                        $scope.uploadPercentage = progressPercentage;
                    });
                  }
                }
            }
        };
    }]).filter("trust", ['$sce', function($sce) {
  return function(htmlCode){
    return $sce.trustAsHtml(htmlCode);
  }
}]);